import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Extension de partage : reçoit des vidéos depuis n'importe quelle app qui
/// propose la feuille de partage iOS (Photos, Fichiers, Snapchat > Souvenirs > Exporter…),
/// les COPIE dans l'App Group, puis l'app principale les synchronise.
/// Aucune récupération de cookies, aucun scraping : seulement ce que l'utilisateur partage.
final class ShareViewController: UIViewController {
    private let model = ShareModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
            .filter { $0.hasItemConformingToTypeIdentifier(UTType.movie.identifier) }
        model.finish = { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) }
        model.cancel = { [weak self] in
            self?.extensionContext?.cancelRequest(withError: CocoaError(.userCancelled))
        }
        let host = UIHostingController(rootView: ShareView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }
}

@MainActor
final class ShareModel: ObservableObject {
    var providers: [NSItemProvider] = []
    var finish: () -> Void = {}
    var cancel: () -> Void = {}
    @Published var fromSnapchat = true
    @Published var imported = 0
    @Published var busy = false
    @Published var error: String?

    func importAll() {
        busy = true
        let origin = fromSnapchat ? "snapchat_memories" : "share"
        Task {
            for p in providers {
                do {
                    try await Self.copy(provider: p, origin: origin)
                    imported += 1
                } catch {
                    self.error = error.localizedDescription
                }
            }
            busy = false
            if error == nil { finish() }
        }
    }

    /// Le fichier fourni n'est valide que pendant le rappel : copie immédiate.
    nonisolated private static func copy(provider: NSItemProvider, origin: String) async throws {
        let name = provider.suggestedName
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
                guard let url else { cont.resume(throwing: error ?? CocoaError(.fileReadUnknown)); return }
                do {
                    let ext = url.pathExtension
                    let original = name.map { ext.isEmpty || $0.hasSuffix(".\(ext)") ? $0 : "\($0).\(ext)" }
                    _ = try ShareInbox.deposit(fileAt: url, originalName: original, origin: origin)
                    cont.resume()
                } catch { cont.resume(throwing: error) }
            }
        }
    }
}

struct ShareView: View {
    @ObservedObject var model: ShareModel

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("\(model.providers.count) vidéo(s) à importer dans Snap Clip")
                    Toggle("Exportée de Snapchat Memories", isOn: $model.fromSnapchat)
                }
                Section {
                    Text("Une copie est envoyée vers ton ordinateur à la prochaine synchronisation. La vidéo d'origine n'est pas touchée.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if let e = model.error { Section { Text(e).foregroundStyle(.red) } }
            }
            .navigationTitle("Snap Clip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuler", action: model.cancel) }
                ToolbarItem(placement: .confirmationAction) {
                    if model.busy { ProgressView() } else {
                        Button("Importer", action: model.importAll).disabled(model.providers.isEmpty)
                    }
                }
            }
        }
    }
}
