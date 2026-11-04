import AVFoundation
import Foundation
import Photos
import UIKit

/// Orchestration de la synchronisation, pilotée par événements pour fonctionner
/// à l'identique au premier plan, en tâche de fond BGTaskScheduler et lors des
/// relances par la session d'upload d'arrière-plan.
///
/// File persistante : `Application Support/sync-state.json`. Les originaux de
/// la photothèque ne sont jamais modifiés ni supprimés.
@MainActor
final class SyncCoordinator: ObservableObject {
    static let shared = SyncCoordinator()

    @Published private(set) var items: [String: SyncItem] = [:]
    @Published private(set) var availableCount = 0
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var isSyncing = false
    @Published private(set) var activity = ""
    @Published private(set) var authorization: PHAuthorizationStatus = .notDetermined
    @Published private(set) var isPaired = APIClient.shared.isPaired
    @Published var lastError: String?
    @Published var paused = UserDefaults.standard.bool(forKey: "paused") {
        didSet { UserDefaults.standard.set(paused, forKey: "paused"); if !paused { Task { await advance() } } }
    }
    @Published var allowCellular = UserDefaults.standard.bool(forKey: "allowCellular") {
        didSet { UserDefaults.standard.set(allowCellular, forKey: "allowCellular") }
    }

    private let api = APIClient.shared
    private let photos = PhotoLibraryService.shared
    private let engine = UploadEngine.shared
    private var inFlight: Set<String> = []     // "itemID|uploadID|index"
    private var advancing = false
    private var bootTask: Task<Void, Never>?
    private var saveTask: Task<Void, Never>?

    private let foregroundWindow = 3                        // morceaux simultanés au premier plan
    private let backgroundStageBytes: Int64 = 512 << 20     // volume confié d'un coup à iOS avant suspension
    private let maxAutoAttempts = 5

    // MARK: statistiques (page d'accueil)

    var syncedCount: Int { items.values.filter { $0.state.isSynced }.count }
    var pendingCount: Int { items.values.filter { $0.state.isPending }.count }
    var failedCount: Int { items.values.filter { $0.state == .failed }.count }
    var bytesTransferred: Int64 { items.values.filter { $0.state.isSynced }.reduce(0) { $0 + ($1.sizeBytes ?? 0) } }
    var current: SyncItem? { items.values.first { $0.state == .uploading && $0.uploadId != nil } }

    // MARK: démarrage

    func ensureBootstrapped() async {
        if bootTask == nil { bootTask = Task { await bootstrap() } }
        await bootTask?.value
    }

    private func bootstrap() async {
        load()
        authorization = photos.status
        engine.onChunkFinished = { [weak self] item, upload, index, status, error in
            Task { @MainActor in await self?.chunkFinished(itemID: item, uploadID: upload, index: index,
                                                           status: status, error: error) }
        }
        engine.onBackgroundEventsFinished = { [weak self] in
            Task { @MainActor in
                await self?.advance()
                self?.saveNow()
                UploadEngine.shared.finishBackgroundEvents()
            }
        }
        inFlight = await engine.inFlight()
        photos.onChange = { [weak self] in
            Task { @MainActor in
                guard let self, !self.isSyncing else { return }
                self.scanLibrary()
                try? await self.registerNew()
                await self.advance()
            }
        }
        photos.startObserving()
    }

    // MARK: autorisations / appairage

    func requestPhotoAccess() async {
        authorization = await photos.requestAuthorization()
        if photos.canRead { await syncNow() }
    }

    func pair(server: URL, code: String) async {
        do {
            try await api.pair(server: server, code: code)
            isPaired = true
            lastError = nil
            await syncNow()
        } catch { lastError = error.localizedDescription }
    }

    func unpair() async {
        await engine.cancelAll()
        await api.unpair()
        isPaired = false
    }

    // MARK: synchronisation complète (bouton SYNCHRONISER MAINTENANT, BGTask, retour au premier plan)

    func syncNow() async {
        await ensureBootstrapped()
        authorization = photos.status
        guard api.isPaired, !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false; activity = ""; saveNow() }
        do {
            try await pollCommands()
            await ingestShareInbox()
            scanLibrary()
            try await registerNew()
            lastSyncAt = Date()
            // une demande explicite relance tout de suite les échecs non définitifs
            for id in items.keys where items[id]?.state == .failed && (items[id]?.attempts ?? 0) < maxAutoAttempts {
                items[id]?.nextAttemptAt = .distantPast
            }
            await advance()
            await cleanupDelivered()
            try await heartbeat()
        } catch { handle(error) }
    }

    /// Tick léger toutes les 30 s quand l'app est ouverte.
    func periodic() async {
        await ensureBootstrapped()
        guard api.isPaired else { return }
        do {
            try await pollCommands()
            await advance()
            try await heartbeat()
        } catch { handle(error) }
    }

    func retryFailed() async {
        for id in items.keys where items[id]?.state == .failed {
            items[id]?.attempts = 0
            items[id]?.nextAttemptAt = .distantPast
        }
        await advance()
    }

    // MARK: découverte

    private func scanLibrary() {
        guard photos.canRead else { availableCount = 0; return }
        let videos = photos.fetchVideos()
        availableCount = videos.count
        for v in videos where items[v.localIdentifier] == nil {
            items[v.localIdentifier] = SyncItem(id: v.localIdentifier, origin: .photos, filename: v.filename,
                                                createdAt: v.createdAt, durationS: v.duration,
                                                width: v.width, height: v.height)
        }
        scheduleSave()
    }

    /// Import par la feuille de partage (ex. vidéo exportée de Snapchat Memories).
    private func ingestShareInbox() async {
        for entry in ShareInbox.pending() {
            let id = "share:\(entry.id)"
            guard items[id] == nil, let url = ShareInbox.fileURL(for: entry) else { ShareInbox.markIngested(entry); continue }
            let asset = AVURLAsset(url: url)
            let duration = (try? await asset.load(.duration)).map(CMTimeGetSeconds)
            let size = try? await asset.loadTracks(withMediaType: .video).first?.load(.naturalSize)
            let created = try? await asset.load(.creationDate)?.load(.dateValue)
            items[id] = SyncItem(id: id, origin: VideoOrigin(rawValue: entry.origin) ?? .share,
                                 filename: entry.originalFilename, createdAt: created ?? entry.receivedAt,
                                 durationS: duration, width: size.map { Int(abs($0.width)) },
                                 height: size.map { Int(abs($0.height)) },
                                 localFile: entry.fileName, localFileInAppGroup: true)
            ShareInbox.markIngested(entry)
        }
    }

    private func registerNew() async throws {
        let fresh = items.values.filter { $0.serverVideoId == nil }.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
        for batch in stride(from: 0, to: fresh.count, by: 200).map({ Array(fresh[$0..<min($0 + 200, fresh.count)]) }) {
            let payload = ["videos": batch.map {
                VideoRegistration(assetLocalId: $0.id, origin: $0.origin.rawValue, filename: $0.filename,
                                  sourceCreatedAt: $0.createdAt, durationS: $0.durationS, width: $0.width,
                                  height: $0.height, sizeBytes: $0.sizeBytes, sha256: $0.sha256)
            }]
            let resp = try await api.send("POST", "v1/videos/batch", body: payload, as: RegisterResponse.self)
            for r in resp.results {
                items[r.assetLocalId]?.serverVideoId = r.video.id
                if let s = SyncState(rawValue: r.video.state) { items[r.assetLocalId]?.state = s }
            }
            activity = "Inventaire : \(items.values.filter { $0.serverVideoId != nil }.count) vidéos"
        }
        scheduleSave()
    }

    // MARK: file d'envoi

    private enum Step { case progressed, waiting }

    /// Fait avancer la file : une vidéo à la fois, les plus récentes d'abord.
    func advance() async {
        await ensureBootstrapped()
        guard !advancing, !paused, api.isPaired else { return }
        advancing = true
        defer { advancing = false }
        while !paused {
            if let active = current {
                if await pump(active.id) == .waiting { return }
                continue
            }
            guard let next = nextCandidate() else { activity = ""; return }
            await prepare(next.id)
        }
    }

    private func nextCandidate() -> SyncItem? {
        let now = Date()
        return items.values
            .filter { $0.serverVideoId != nil && $0.nextAttemptAt <= now }
            .filter { [.discovered, .queued, .uploading].contains($0.state) || ($0.state == .failed && $0.attempts < maxAutoAttempts) }
            .max { ($0.createdAt ?? .distantPast) < ($1.createdAt ?? .distantPast) }
    }

    private var exportsDir: URL {
        var dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var rv = URLResourceValues(); rv.isExcludedFromBackup = true
        try? dir.setResourceValues(rv)
        return dir
    }

    private func fileURL(_ item: SyncItem) -> URL? {
        guard let name = item.localFile else { return nil }
        return item.localFileInAppGroup ? ShareInbox.directory?.appendingPathComponent(name) : exportsDir.appendingPathComponent(name)
    }

    /// Export PhotoKit -> SHA-256 -> empreinte (déduplication) -> session d'upload.
    private func prepare(_ id: String) async {
        guard var item = items[id], let sid = item.serverVideoId else { return }
        activity = "Préparation de \(item.filename)"
        do {
            var url = fileURL(item)
            var mustHash = item.sha256 == nil
            if url == nil || !FileManager.default.fileExists(atPath: url!.path) {
                guard item.origin == .photos else { throw SyncError.sharedFileMissing }
                let ext = (item.filename as NSString).pathExtension.isEmpty ? "mov" : (item.filename as NSString).pathExtension
                let name = id.replacingOccurrences(of: "/", with: "_") + "." + ext
                activity = "Récupération de \(item.filename) (iCloud si nécessaire)"
                try await photos.export(localIdentifier: id, to: exportsDir.appendingPathComponent(name))
                item.localFile = name
                item.localFileInAppGroup = false
                url = exportsDir.appendingPathComponent(name)
                mustHash = true
            }
            if mustHash || item.sizeBytes == nil {
                // fichier privé à l'app et inchangé depuis son empreinte : on ne re-hache pas à chaque reprise
                activity = "Empreinte de \(item.filename)"
                let src = url!
                let (sha, size) = try await Task.detached(priority: .utility) {
                    let attrs = try FileManager.default.attributesOfItem(atPath: src.path)
                    return (try FileHasher.sha256(of: src), (attrs[.size] as? NSNumber)?.int64Value ?? 0)
                }.value
                item.sha256 = sha
                item.sizeBytes = size
            }
            guard let sha = item.sha256, let size = item.sizeBytes else { throw SyncError.sharedFileMissing }
            let fp = try await api.send("POST", "v1/videos/\(sid)/fingerprint",
                                        body: FingerprintBody(sha256: sha, sizeBytes: size), as: FingerprintResponse.self)
            item.serverVideoId = fp.video.id                       // vidéo canonique si doublon
            item.state = SyncState(rawValue: fp.video.state) ?? .queued
            if item.state.isSynced { finishSynced(&item); items[id] = item; return }
            do {
                let s = try await api.send("POST", "v1/videos/\(fp.video.id)/uploads", body: UploadCreate(chunkSize: nil),
                                           as: UploadSessionDTO.self)
                item.uploadId = s.uploadId
                item.chunkSize = s.chunkSize
                item.totalChunks = s.totalChunks
                item.uploadedChunks = Set(s.received)              // reprise : morceaux déjà reçus par le serveur
                item.state = .uploading
            } catch let e as APIError where e.status == 409 && (e.detail?["code"] as? String) == "already_uploaded" {
                item.state = .verified
                finishSynced(&item)
            }
            items[id] = item
            scheduleSave()
        } catch {
            items[id] = item
            fail(id, error)
        }
    }

    private func pump(_ id: String) async -> Step {
        guard let item = items[id], let uid = item.uploadId, let total = item.totalChunks, let cs = item.chunkSize else {
            return .progressed
        }
        guard let url = fileURL(item), FileManager.default.fileExists(atPath: url.path) else {
            // export supprimé : on le refera, le serveur conservera les morceaux reçus
            items[id]?.uploadId = nil; items[id]?.localFile = nil; items[id]?.state = .queued
            return .progressed
        }
        if item.uploadedChunks.count >= total { return await complete(id) }
        let prefix = "\(id)|\(uid)|"
        let flying = Set(inFlight.filter { $0.hasPrefix(prefix) }.compactMap { Int($0.dropFirst(prefix.count)) })
        let missing = (0..<total).filter { !item.uploadedChunks.contains($0) && !flying.contains($0) }
        let inBackground = UIApplication.shared.applicationState == .background
        let window = inBackground ? max(1, Int(backgroundStageBytes / Int64(cs))) : foregroundWindow
        let slots = window - flying.count
        activity = "Envoi de \(item.filename) — \(Int(item.progress * 100)) %"
        guard slots > 0, !missing.isEmpty, let base = api.baseURL else { return .waiting }
        do {
            let token = try await api.validAccessToken()
            for index in missing.prefix(slots) {
                try engine.enqueue(itemID: id, uploadID: uid, index: index, source: url, chunkSize: cs,
                                   baseURL: base, accessToken: token, allowCellular: allowCellular)
                inFlight.insert(prefix + String(index))
            }
        } catch {
            fail(id, error)
            return .progressed
        }
        return .waiting
    }

    private func chunkFinished(itemID: String, uploadID: String, index: Int, status: Int?, error: Error?) async {
        await ensureBootstrapped()
        inFlight.remove("\(itemID)|\(uploadID)|\(index)")
        guard items[itemID]?.uploadId == uploadID else { return }
        switch status {
        case 200:
            items[itemID]?.uploadedChunks.insert(index)
            items[itemID]?.error = nil
        case 401:
            await api.invalidateAccessToken()                 // renvoyé au prochain passage avec un jeton neuf
        case 410:
            items[itemID]?.uploadId = nil                     // session expirée : on en rouvre une
            items[itemID]?.state = .queued
        case nil:
            if (error as? URLError)?.code == .cancelled { return }
            fail(itemID, error ?? SyncError.network)          // coupure réseau : reprise après délai
        default:
            fail(itemID, SyncError.server(status!))
        }
        scheduleSave()
        await advance()
    }

    private func complete(_ id: String) async -> Step {
        guard var item = items[id], let uid = item.uploadId else { return .progressed }
        activity = "Vérification de \(item.filename)"
        do {
            let v = try await api.send("POST", "v1/uploads/\(uid)/complete", body: Empty(), as: ServerVideo.self)
            item.state = SyncState(rawValue: v.state) ?? .verified
            finishSynced(&item)
            items[id] = item
        } catch let e as APIError where e.status == 409 {
            if let missing = e.detail?["missing"] as? [Int] { items[id]?.uploadedChunks.subtract(missing) }
        } catch let e as APIError where e.status == 422 {
            // empreinte globale différente : le fichier sera ré-exporté
            if item.origin == .photos, let url = fileURL(item) { try? FileManager.default.removeItem(at: url); item.localFile = nil }
            item.uploadId = nil
            item.sha256 = nil                                   // empreinte recalculée au prochain essai
            items[id] = item
            fail(id, e)
        } catch {
            fail(id, error)
        }
        saveNow()
        return .progressed
    }

    private func finishSynced(_ item: inout SyncItem) {
        item.uploadId = nil
        item.error = nil
        item.attempts = 0
        // Copie temporaire d'export supprimée ; l'original reste dans Photos.
        // Les fichiers reçus par partage sont gardés jusqu'à leur arrivée sur l'ordinateur.
        if item.origin == .photos, let url = fileURL(item) {
            try? FileManager.default.removeItem(at: url)
            item.localFile = nil
        }
    }

    private func cleanupDelivered() async {
        for item in items.values where item.localFileInAppGroup && item.localFile != nil && item.state.isSynced {
            guard let sid = item.serverVideoId,
                  let v = try? await api.get("v1/videos/\(sid)", as: ServerVideo.self), v.deliveredAt != nil else { continue }
            ShareInbox.removeFile(named: item.localFile!)
            items[item.id]?.localFile = nil
        }
    }

    // MARK: erreurs

    enum SyncError: LocalizedError {
        case sharedFileMissing, network, server(Int)
        var errorDescription: String? {
            switch self {
            case .sharedFileMissing: "Fichier partagé introuvable"
            case .network: "Connexion interrompue"
            case let .server(c): "Erreur serveur \(c)"
            }
        }
    }

    private func fail(_ id: String, _ error: Error) {
        if case APIError.revoked = error { handle(error); return }
        guard var item = items[id] else { return }
        let transient: Bool
        if error is URLError { transient = true }
        else if case SyncError.network = error { transient = true }
        else { transient = false }
        item.attempts += transient ? 0 : 1
        item.error = error.localizedDescription
        item.nextAttemptAt = Date().addingTimeInterval(min(3600, 30 * pow(2, Double(max(item.attempts, 1)))))
        if !transient { item.state = .failed }
        if transient, item.state == .uploading { item.state = .queued }  // la session serveur reste ouverte
        items[id] = item
        scheduleSave()
    }

    private func handle(_ error: Error) {
        if case APIError.revoked = error { isPaired = false }
        lastError = error.localizedDescription
    }

    // MARK: Cloud : commandes et état de l'appareil

    private func pollCommands() async throws {
        for cmd in try await api.get("v1/devices/me/commands", as: [RemoteCommand].self) {
            switch cmd.kind {
            case "pause": paused = true
            case "resume": paused = false
            default: paused = false   // sync_now : la synchronisation en cours fait le travail
            }
        }
    }

    private func heartbeat() async throws {
        let free = (try? URL(fileURLWithPath: NSHomeDirectory())
            .resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage) ?? nil
        let auth: String = switch authorization {
        case .authorized: "full"
        case .limited: "limited"
        case .denied, .restricted: "denied"
        default: "not_determined"
        }
        var status: [String: Any] = [
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            "os_version": UIDevice.current.systemVersion,
            "photo_authorization": auth,
            "videos_available": availableCount, "videos_synced": syncedCount,
            "videos_pending": pendingCount, "videos_failed": failedCount,
            "bytes_transferred": bytesTransferred, "paused": paused, "current_task": activity,
        ]
        if let free { status["disk_free_bytes"] = free }
        if let lastSyncAt { status["last_sync_at"] = ISO8601DateFormatter().string(from: lastSyncAt) }
        _ = try await api.post("v1/devices/me/heartbeat", dict: ["status": status])
    }

    // MARK: persistance

    private struct Persisted: Codable { var items: [SyncItem]; var lastSyncAt: Date? }

    private var stateURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sync-state.json")
    }

    private func load() {
        guard let data = try? Data(contentsOf: stateURL),
              let p = try? JSONDecoder().decode(Persisted.self, from: data) else { return }
        items = Dictionary(uniqueKeysWithValues: p.items.map { ($0.id, $0) })
        lastSyncAt = p.lastSyncAt
    }

    func saveNow() {
        saveTask?.cancel()
        let snapshot = Persisted(items: Array(items.values), lastSyncAt: lastSyncAt)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }
}

struct FingerprintBody: Encodable { let sha256: String; let sizeBytes: Int64 }
struct UploadCreate: Encodable { let chunkSize: Int? }
