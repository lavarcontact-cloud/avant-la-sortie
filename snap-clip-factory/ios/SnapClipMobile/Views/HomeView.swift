import Photos
import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var sync: SyncCoordinator

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    PermissionBanner()
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatCard(label: "Vidéos disponibles", value: "\(sync.availableCount)")
                        StatCard(label: "Synchronisées", value: "\(sync.syncedCount)")
                        StatCard(label: "En attente", value: "\(sync.pendingCount)")
                        StatCard(label: "Échecs", value: "\(sync.failedCount)", alert: sync.failedCount > 0)
                        StatCard(label: "Volume transféré",
                                 value: ByteCountFormatter.string(fromByteCount: sync.bytesTransferred, countStyle: .file))
                        StatCard(label: "Dernière synchro",
                                 value: sync.lastSyncAt.map { $0.formatted(.relative(presentation: .named)) } ?? "jamais")
                    }

                    if let item = sync.current {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.filename).font(.footnote).lineLimit(1)
                            ProgressView(value: item.progress)
                        }
                        .padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }
                    if !sync.activity.isEmpty {
                        Text(sync.activity).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        Task { await sync.syncNow() }
                    } label: {
                        HStack {
                            if sync.isSyncing { ProgressView().tint(.black) }
                            Text("SYNCHRONISER MAINTENANT").font(.headline)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(.black)
                    .disabled(sync.isSyncing || !PhotoLibraryService.shared.canRead)

                    Toggle("Suspendre les transferts", isOn: $sync.paused)
                        .padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))

                    if let err = sync.lastError {
                        Text(err).font(.footnote).foregroundStyle(.red)
                    }

                    Text("iOS peut poursuivre les envois en arrière-plan et relancer l'app de temps en temps, mais ne garantit pas de synchronisation permanente. Ouvre l'app ou touche le bouton pour tout synchroniser.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("Snap Clip")
            .refreshable { await sync.syncNow() }
        }
    }
}

private struct StatCard: View {
    let label: String
    let value: String
    var alert = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.title2.monospacedDigit().bold()).foregroundStyle(alert ? .red : .primary)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct PermissionBanner: View {
    @EnvironmentObject private var sync: SyncCoordinator
    @Environment(\.openURL) private var openURL

    var body: some View {
        switch sync.authorization {
        case .authorized:
            EmptyView()
        case .limited:
            banner("Accès limité : seules les vidéos que tu as choisies sont visibles.", action: "Choisir d'autres vidéos") {
                PhotoLibraryService.shared.presentLimitedPicker()
            }
        case .denied, .restricted:
            banner("L'accès aux Photos est refusé. Snap Clip ne peut pas lire tes vidéos.", action: "Ouvrir Réglages") {
                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            }
        default:
            banner("Snap Clip a besoin de lire tes vidéos pour les copier vers ton ordinateur. Rien n'est modifié ni supprimé.",
                   action: "Autoriser l'accès aux Photos") {
                Task { await sync.requestPhotoAccess() }
            }
        }
    }

    private func banner(_ text: String, action: String, perform: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text).font(.callout)
            Button(action, action: perform).buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
    }
}
