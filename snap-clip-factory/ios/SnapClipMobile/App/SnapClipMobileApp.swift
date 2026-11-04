import SwiftUI
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BackgroundSync.register()
        UploadEngine.shared.reconnect()
        Task { @MainActor in await SyncCoordinator.shared.ensureBootstrapped() }
        return true
    }

    /// iOS relance l'app quand les envois confiés à la session d'arrière-plan sont terminés.
    func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        guard identifier == UploadEngine.sessionIdentifier else { completionHandler(); return }
        UploadEngine.shared.backgroundCompletionHandler = completionHandler
        UploadEngine.shared.reconnect()
    }
}

@main
struct SnapClipMobileApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var sync = SyncCoordinator.shared
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sync)
                .preferredColorScheme(.dark)
        }
        .onChange(of: phase) { _, newPhase in
            switch newPhase {
            case .active:
                Task { await sync.syncNow() }
            case .background:
                sync.saveNow()
                BackgroundSync.schedule()
                // quelques secondes de sursis pour confier à iOS un lot plus large de morceaux
                var bgID = UIBackgroundTaskIdentifier.invalid
                bgID = UIApplication.shared.beginBackgroundTask(withName: "stage-chunks") {
                    UIApplication.shared.endBackgroundTask(bgID)
                }
                Task {
                    await sync.advance()
                    sync.saveNow()
                    UIApplication.shared.endBackgroundTask(bgID)
                }
            default:
                break
            }
        }
    }
}
