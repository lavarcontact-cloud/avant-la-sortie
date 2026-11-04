import Foundation

/// Boîte de dépôt partagée entre l'extension de partage et l'app (App Group).
/// L'extension y copie les vidéos reçues (ex. export Snapchat Memories) avec
/// une fiche JSON ; l'app les ingère au prochain lancement ou réveil.
enum ShareInbox {
    static let appGroup = "group.com.snapclipfactory.mobile"

    struct Entry: Codable {
        let id: String
        let originalFilename: String
        let origin: String          // "share" | "snapchat_memories"
        let receivedAt: Date
        let fileName: String        // nom du fichier dans le dossier inbox
    }

    static var directory: URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let dir = base.appendingPathComponent("Inbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Appelé par l'extension : copie (jamais de déplacement de l'original).
    static func deposit(fileAt source: URL, originalName: String?, origin: String) throws -> Entry {
        guard let dir = directory else { throw CocoaError(.fileNoSuchFile) }
        let id = UUID().uuidString
        let ext = source.pathExtension.isEmpty ? "mp4" : source.pathExtension
        let fileName = "\(id).\(ext)"
        try FileManager.default.copyItem(at: source, to: dir.appendingPathComponent(fileName))
        let entry = Entry(id: id, originalFilename: originalName ?? source.lastPathComponent, origin: origin,
                          receivedAt: Date(), fileName: fileName)
        let data = try JSONEncoder().encode(entry)
        try data.write(to: dir.appendingPathComponent("\(id).json"), options: .atomic)
        return entry
    }

    /// Appelé par l'app : liste les dépôts en attente d'ingestion.
    static func pending() -> [Entry] {
        guard let dir = directory,
              let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return [] }
        return files.filter { $0.pathExtension == "json" }.compactMap {
            try? JSONDecoder().decode(Entry.self, from: Data(contentsOf: $0))
        }
    }

    static func fileURL(for entry: Entry) -> URL? { directory?.appendingPathComponent(entry.fileName) }

    static func markIngested(_ entry: Entry) {
        guard let dir = directory else { return }
        try? FileManager.default.removeItem(at: dir.appendingPathComponent("\(entry.id).json"))
    }

    static func removeFile(named fileName: String) {
        guard let dir = directory else { return }
        try? FileManager.default.removeItem(at: dir.appendingPathComponent(fileName))
    }
}
