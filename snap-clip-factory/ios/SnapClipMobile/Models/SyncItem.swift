import Foundation

/// États alignés sur le protocole serveur.
enum SyncState: String, Codable, CaseIterable {
    case discovered = "DISCOVERED"
    case queued = "QUEUED"
    case uploading = "UPLOADING"
    case uploaded = "UPLOADED"
    case verified = "VERIFIED"
    case processing = "PROCESSING"
    case completed = "COMPLETED"
    case failed = "FAILED"

    /// Pour l'iPhone, le travail est fini dès que le serveur a vérifié l'empreinte.
    var isSynced: Bool { [.verified, .processing, .completed].contains(self) }
    var isPending: Bool { [.discovered, .queued, .uploading, .uploaded].contains(self) }

    var label: String {
        switch self {
        case .discovered: "Détectée"
        case .queued: "En file"
        case .uploading: "Envoi"
        case .uploaded: "Reçue"
        case .verified: "Vérifiée"
        case .processing: "Traitement"
        case .completed: "Terminée"
        case .failed: "Échec"
        }
    }
}

enum VideoOrigin: String, Codable { case photos, share, snapchatMemories = "snapchat_memories" }

struct SyncItem: Codable, Identifiable, Equatable {
    /// Identifiant interne : localIdentifier PhotoKit, ou "share:<uuid>".
    var id: String
    var origin: VideoOrigin
    var filename: String
    var createdAt: Date?
    var durationS: Double?
    var width: Int?
    var height: Int?
    var sizeBytes: Int64?
    var sha256: String?

    var serverVideoId: String?
    var state: SyncState = .discovered
    var error: String?
    var attempts: Int = 0
    var nextAttemptAt: Date = .distantPast

    // Upload en cours
    var uploadId: String?
    var chunkSize: Int?
    var totalChunks: Int?
    var uploadedChunks: Set<Int> = []
    /// Fichier exporté (Application Support/exports) ou déposé via le partage (App Group).
    var localFile: String?
    var localFileInAppGroup: Bool = false

    var progress: Double {
        guard let total = totalChunks, total > 0 else { return state.isSynced ? 1 : 0 }
        return Double(uploadedChunks.count) / Double(total)
    }
}
