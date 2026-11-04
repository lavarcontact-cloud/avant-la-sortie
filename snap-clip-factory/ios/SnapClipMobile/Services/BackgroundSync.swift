import BackgroundTasks
import Foundation

/// Synchronisation OPPORTUNISTE en arrière-plan. iOS décide seul quand (et si)
/// ces tâches s'exécutent, selon la batterie, le réseau et l'usage de l'app :
/// aucune synchronisation permanente n'est garantie. Le bouton
/// SYNCHRONISER MAINTENANT reste la voie fiable.
enum BackgroundSync {
    static let refreshID = "com.snapclipfactory.mobile.refresh"   // court : inventaire + commandes
    static let syncID = "com.snapclipfactory.mobile.sync"         // long : export, empreinte, envoi

    /// À appeler avant la fin de `didFinishLaunching`.
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshID, using: nil) { task in
            run(task, schedule: true)
        }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: syncID, using: nil) { task in
            run(task, schedule: true)
        }
    }

    static func schedule() {
        let refresh = BGAppRefreshTaskRequest(identifier: refreshID)
        refresh.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(refresh)

        let processing = BGProcessingTaskRequest(identifier: syncID)
        processing.requiresNetworkConnectivity = true
        processing.requiresExternalPower = false
        processing.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(processing)
    }

    private final class Once: @unchecked Sendable {
        private var done = false
        private let lock = NSLock()
        func callAsFunction(_ body: () -> Void) {
            lock.lock(); defer { lock.unlock() }
            guard !done else { return }
            done = true
            body()
        }
    }

    private static func run(_ task: BGTask, schedule again: Bool) {
        if again { schedule() }
        let once = Once()
        let work = Task { @MainActor in
            await SyncCoordinator.shared.syncNow()
            SyncCoordinator.shared.saveNow()
            once { task.setTaskCompleted(success: true) }
        }
        task.expirationHandler = {
            // iOS reprend la main : on s'arrête proprement, l'état est déjà persisté
            work.cancel()
            Task { @MainActor in SyncCoordinator.shared.saveNow() }
            once { task.setTaskCompleted(success: false) }
        }
    }
}
