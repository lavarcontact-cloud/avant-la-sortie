import Foundation
import UIKit

enum APIError: Error, LocalizedError {
    case notPaired
    case revoked
    case http(Int, Data)
    case invalidServer

    var errorDescription: String? {
        switch self {
        case .notPaired: "Application non appairée"
        case .revoked: "Appareil révoqué depuis le dashboard : appairer à nouveau"
        case .invalidServer: "Adresse du serveur invalide (HTTPS requis)"
        case let .http(code, data):
            "HTTP \(code) : " + (String(data: data, encoding: .utf8) ?? "")
        }
    }

    var status: Int? { if case let .http(c, _) = self { c } else { nil } }

    /// Champ `detail` renvoyé par FastAPI, quand c'est un objet.
    var detail: [String: Any]? {
        guard case let .http(_, data) = self,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj["detail"] as? [String: Any]
    }
}

struct TokenPair: Decodable { let accessToken: String; let refreshToken: String; let expiresIn: Int; let deviceId: String }

/// Client du Cloud Control Plane. Jeton d'accès court en mémoire, jeton de
/// rafraîchissement (rotatif) dans le trousseau.
actor APIClient {
    static let shared = APIClient()

    private var accessToken: String?
    private var accessExpiry = Date.distantPast
    private let session: URLSession
    let decoder: JSONDecoder = { let d = JSONDecoder(); d.keyDecodingStrategy = .convertFromSnakeCase; return d }()
    let encoder: JSONEncoder = {
        let e = JSONEncoder(); e.keyEncodingStrategy = .convertToSnakeCase; e.dateEncodingStrategy = .iso8601; return e
    }()

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.waitsForConnectivity = true
        cfg.timeoutIntervalForRequest = 60
        cfg.timeoutIntervalForResource = 300
        session = URLSession(configuration: cfg)
    }

    nonisolated var baseURL: URL? { UserDefaults.standard.url(forKey: "serverURL") }
    nonisolated var isPaired: Bool { baseURL != nil && KeychainStore.get("refresh_token") != nil }

    // MARK: appairage / jetons

    func pair(server: URL, code: String) async throws {
        guard server.scheme == "https" || server.host == "localhost" || (server.host ?? "").hasSuffix(".local")
                || (server.host ?? "").hasPrefix("192.168.") else { throw APIError.invalidServer }
        let (name, os) = await MainActor.run { (UIDevice.current.name, "iOS \(UIDevice.current.systemVersion)") }
        var req = URLRequest(url: server.appendingPathComponent("v1/devices/pair"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "code": code.uppercased().trimmingCharacters(in: .whitespaces), "name": name, "kind": "ios", "platform": os,
        ])
        let (data, resp) = try await session.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 201 else {
            throw APIError.http((resp as? HTTPURLResponse)?.statusCode ?? 0, data)
        }
        UserDefaults.standard.set(server, forKey: "serverURL")
        store(try decoder.decode(TokenPair.self, from: data))
    }

    func unpair() {
        KeychainStore.delete("refresh_token")
        accessToken = nil
        UserDefaults.standard.removeObject(forKey: "serverURL")
    }

    private func store(_ pair: TokenPair) {
        KeychainStore.set(pair.refreshToken, for: "refresh_token")
        accessToken = pair.accessToken
        accessExpiry = Date().addingTimeInterval(TimeInterval(pair.expiresIn - 30))
    }

    /// Jeton valide (renouvelé si besoin). Utilisé aussi pour signer les
    /// requêtes d'upload confiées à la session d'arrière-plan.
    func validAccessToken() async throws -> String {
        if let t = accessToken, Date() < accessExpiry { return t }
        guard let base = baseURL, let refresh = KeychainStore.get("refresh_token") else { throw APIError.notPaired }
        var req = URLRequest(url: base.appendingPathComponent("v1/auth/refresh"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refresh])
        let (data, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 { KeychainStore.delete("refresh_token"); throw APIError.revoked }
        guard code == 200 else { throw APIError.http(code, data) }
        store(try decoder.decode(TokenPair.self, from: data))
        return accessToken!
    }

    func invalidateAccessToken() { accessToken = nil }

    // MARK: requêtes

    func raw(_ method: String, _ path: String, json: Data? = nil) async throws -> Data {
        guard let base = baseURL else { throw APIError.notPaired }
        for attempt in 0..<2 {
            var req = URLRequest(url: URL(string: path, relativeTo: base)!)
            req.httpMethod = method
            req.setValue("Bearer \(try await validAccessToken())", forHTTPHeaderField: "Authorization")
            if let json { req.httpBody = json; req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
            let (data, resp) = try await session.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 401 && attempt == 0 { accessToken = nil; continue }
            if code == 401 { throw APIError.revoked }
            guard (200..<300).contains(code) else { throw APIError.http(code, data) }
            return data
        }
        throw APIError.revoked
    }

    func send<T: Decodable, B: Encodable>(_ method: String, _ path: String, body: B, as type: T.Type) async throws -> T {
        try decoder.decode(T.self, from: try await raw(method, path, json: try encoder.encode(body)))
    }

    func get<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        try decoder.decode(T.self, from: try await raw("GET", path))
    }

    func post(_ path: String, dict: [String: Any] = [:]) async throws -> Data {
        try await raw("POST", path, json: try JSONSerialization.data(withJSONObject: dict))
    }
}

struct Empty: Codable {}

// MARK: DTO serveur

struct ServerVideo: Decodable {
    let id: String
    let assetLocalId: String
    let state: String
    let error: String?
    let relayPresent: Bool
    let deliveredAt: String?
}

struct RegisterResult: Decodable { let assetLocalId: String; let deduplicated: Bool; let video: ServerVideo }
struct RegisterResponse: Decodable { let results: [RegisterResult] }
struct FingerprintResponse: Decodable { let deduplicated: Bool; let video: ServerVideo }

struct UploadSessionDTO: Decodable {
    let uploadId: String
    let videoId: String
    let chunkSize: Int
    let totalSize: Int64
    let totalChunks: Int
    let status: String
    let received: [Int]
}

struct VideoRegistration: Encodable {
    let assetLocalId: String
    let origin: String
    let filename: String
    let sourceCreatedAt: Date?
    let durationS: Double?
    let width: Int?
    let height: Int?
    let sizeBytes: Int64?
    let sha256: String?
}

struct RemoteCommand: Decodable { let id: String; let kind: String }
