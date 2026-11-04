import Photos
import UIKit

/// Accès à la photothèque par PhotoKit uniquement, dans le respect du choix de
/// l'utilisateur (accès complet ou limité). Lecture seule : aucun asset n'est
/// jamais modifié ni supprimé.
final class PhotoLibraryService: NSObject, PHPhotoLibraryChangeObserver {
    static let shared = PhotoLibraryService()
    var onChange: (() -> Void)?

    var status: PHAuthorizationStatus { PHPhotoLibrary.authorizationStatus(for: .readWrite) }
    var canRead: Bool { status == .authorized || status == .limited }

    func requestAuthorization() async -> PHAuthorizationStatus {
        let s = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        if s == .authorized || s == .limited { PHPhotoLibrary.shared().register(self) }
        return s
    }

    func startObserving() { if canRead { PHPhotoLibrary.shared().register(self) } }

    func photoLibraryDidChange(_ changeInstance: PHChange) { onChange?() }

    /// En accès limité : laisse l'utilisateur ajouter des vidéos à la sélection.
    @MainActor func presentLimitedPicker() {
        guard let root = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first?
            .rootViewController else { return }
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: root)
    }

    struct VideoInfo {
        let localIdentifier: String
        let filename: String
        let createdAt: Date?
        let duration: Double
        let width: Int
        let height: Int
    }

    /// Toutes les vidéos accessibles, les plus récentes d'abord.
    func fetchVideos() -> [VideoInfo] {
        guard canRead else { return [] }
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        opts.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared, .typeiTunesSynced]
        let result = PHAsset.fetchAssets(with: .video, options: opts)
        var out: [VideoInfo] = []
        out.reserveCapacity(result.count)
        result.enumerateObjects { asset, _, _ in
            let name = PHAssetResource.assetResources(for: asset).first(where: { $0.type == .video })?.originalFilename
            out.append(VideoInfo(localIdentifier: asset.localIdentifier, filename: name ?? "video.mov",
                                 createdAt: asset.creationDate, duration: asset.duration,
                                 width: asset.pixelWidth, height: asset.pixelHeight))
        }
        return out
    }

    func availableVideoCount() -> Int {
        guard canRead else { return 0 }
        return PHAsset.fetchAssets(with: .video, options: nil).count
    }

    enum ExportError: Error { case assetGone, noVideoResource }

    /// Copie le fichier vidéo (téléchargé depuis iCloud si besoin) vers `url`.
    /// On prend la version affichée dans Photos (montage inclus) si elle existe,
    /// sinon l'original.
    func export(localIdentifier: String, to url: URL) async throws {
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil).firstObject else {
            throw ExportError.assetGone
        }
        let resources = PHAssetResource.assetResources(for: asset)
        guard let res = resources.first(where: { $0.type == .fullSizeVideo }) ?? resources.first(where: { $0.type == .video })
        else { throw ExportError.noVideoResource }
        try? FileManager.default.removeItem(at: url)
        let opts = PHAssetResourceRequestOptions()
        opts.isNetworkAccessAllowed = true
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            PHAssetResourceManager.default().writeData(for: res, toFile: url, options: opts) { error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
    }
}
