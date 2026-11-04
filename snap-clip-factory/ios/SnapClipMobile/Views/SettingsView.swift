import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncCoordinator
    @State private var confirmUnpair = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Réseau") {
                    Toggle("Autoriser les données cellulaires", isOn: $sync.allowCellular)
                    Text("Désactivé : envois en Wi-Fi uniquement. Jamais en mode Données réduites.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Photothèque") {
                    Button("Modifier la sélection de vidéos") { PhotoLibraryService.shared.presentLimitedPicker() }
                        .disabled(sync.authorization != .limited)
                    Text("Snap Clip n'efface jamais une vidéo de ton iPhone, même après transfert.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Snapchat") {
                    Text("Dans Snapchat > Souvenirs, ouvre une vidéo, touche Partager > Snap Clip. Ou exporte-la d'abord vers Photos : elle sera synchronisée automatiquement.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Serveur") {
                    Text(APIClient.shared.baseURL?.absoluteString ?? "—").font(.footnote.monospaced())
                    Button("Désappairer cet iPhone", role: .destructive) { confirmUnpair = true }
                }
            }
            .navigationTitle("Réglages")
            .confirmationDialog("Désappairer ? Les transferts en cours seront annulés.", isPresented: $confirmUnpair,
                                titleVisibility: .visible) {
                Button("Désappairer", role: .destructive) { Task { await sync.unpair() } }
            }
        }
    }
}
