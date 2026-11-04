import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sync: SyncCoordinator

    var body: some View {
        Group {
            if sync.isPaired {
                TabView {
                    HomeView().tabItem { Label("Accueil", systemImage: "arrow.triangle.2.circlepath") }
                    VideoListView().tabItem { Label("Vidéos", systemImage: "film.stack") }
                    SettingsView().tabItem { Label("Réglages", systemImage: "gearshape") }
                }
                .task {
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .seconds(30))
                        await sync.periodic()
                    }
                }
            } else {
                PairingView()
            }
        }
        .tint(Color(red: 1, green: 0.36, blue: 0.24))
    }
}
