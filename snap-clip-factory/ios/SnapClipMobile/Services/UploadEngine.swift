import Foundation

/// Envoi des morceaux par une URLSession d'ARRIÈRE-PLAN : iOS poursuit les
/// transferts déjà confiés même si l'app est suspendue ou tuée par le système,
/// et la relance (`handleEventsForBackgroundURLSession`) quand ils sont finis.
/// iOS ne garantit ni le moment ni le débit de ces transferts.
final class UploadEngine: NSObject, URLSessionTaskDelegate, URLSessionDataDelegate {
    static let shared = UploadEngine()
    static let sessionIdentifier = "com.snapclipfactory.mobile.upload"

    /// Rappel fourni par iOS lors d'une relance en arrière-plan.
    var backgroundCompletionHandler: (() -> Void)?
    /// (itemID, uploadID, index, statut HTTP ou nil si erreur réseau, erreur)
    var onChunkFinished: ((String, String, Int, Int?, Error?) -> Void)?
    /// Tous les événements de la relance ont été livrés : le coordinateur
    /// confie les morceaux suivants à iOS puis appelle `finishBackgroundEvents()`.
    var onBackgroundEventsFinished: (() -> Void)?

    /// Instancie la session pour recevoir les événements en attente.
    func reconnect() { _ = session }

    func finishBackgroundEvents() {
        DispatchQueue.main.async {
            self.backgroundCompletionHandler?()
            self.backgroundCompletionHandler = nil
        }
    }

    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        cfg.sessionSendsLaunchEvents = true
        cfg.isDiscretionary = false
        cfg.httpMaximumConnectionsPerHost = 3
        cfg.timeoutIntervalForResource = 24 * 3600
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()

    private var chunkDir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("chunks", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Réveille la session (à appeler au lancement) et renvoie les morceaux en vol.
    func inFlight() async -> Set<String> {
        let tasks = await session.allTasks
        return Set(tasks.compactMap { $0.state == .running || $0.state == .suspended ? $0.taskDescription : nil })
    }

    func cancelAll() async {
        for t in await session.allTasks { t.cancel() }
    }

    /// Prépare le morceau `index` (copie de la plage d'octets dans un fichier
    /// temporaire, condition imposée par les sessions d'arrière-plan) et le confie à iOS.
    func enqueue(itemID: String, uploadID: String, index: Int, source: URL, chunkSize: Int,
                 baseURL: URL, accessToken: String, allowCellular: Bool) throws {
        let handle = try FileHandle(forReadingFrom: source)
        defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(index) * UInt64(chunkSize))
        let data = try handle.read(upToCount: chunkSize) ?? Data()
        let file = chunkDir.appendingPathComponent("\(uploadID)-\(index)")
        try data.write(to: file, options: .atomic)

        var req = URLRequest(url: baseURL.appendingPathComponent("v1/uploads/\(uploadID)/chunks/\(index)"))
        req.httpMethod = "PUT"
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(FileHasher.sha256(of: data), forHTTPHeaderField: "X-Chunk-SHA256")
        req.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        // Limitation réseau : pas de données cellulaires sauf choix explicite,
        // jamais en mode Données réduites.
        req.allowsCellularAccess = allowCellular
        req.allowsExpensiveNetworkAccess = allowCellular
        req.allowsConstrainedNetworkAccess = false
        let task = session.uploadTask(with: req, fromFile: file)
        task.taskDescription = "\(itemID)|\(uploadID)|\(index)"
        task.countOfBytesClientExpectsToSend = Int64(data.count)
        task.countOfBytesClientExpectsToReceive = 512
        task.resume()
    }

    // MARK: URLSessionDelegate

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let parts = task.taskDescription?.split(separator: "|"), parts.count == 3,
              let index = Int(parts[2]) else { return }
        let itemID = String(parts[0]), uploadID = String(parts[1])
        try? FileManager.default.removeItem(at: chunkDir.appendingPathComponent("\(uploadID)-\(index)"))
        let status = (task.response as? HTTPURLResponse)?.statusCode
        onChunkFinished?(itemID, uploadID, index, error == nil ? status : nil, error)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        if let cb = onBackgroundEventsFinished { cb() } else { finishBackgroundEvents() }
    }
}
