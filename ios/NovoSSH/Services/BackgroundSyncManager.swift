#if os(iOS)
import Foundation
import BackgroundTasks

@MainActor
final class BackgroundSyncManager: ObservableObject {
  static let shared = BackgroundSyncManager()

  private let appStore: AppStore
  private let taskIdentifier = "com.novossh.backgroundSync"

  @Published var lastSyncTime: Date?
  @Published var isSyncScheduled = false
  @Published var nextSyncTime: Date?

  init(appStore: AppStore? = nil) {
    self.appStore = appStore ?? AppStore()
  }

  private func syncAll(store: AppStore) async {
    guard APIService.shared.isLoggedIn else { return }
    do {
      let remote = try await APIService.shared.sync(
        localHosts: store.hosts,
        localKeys: store.keys,
        localSnippets: store.snippets
      )
      let iso = ISO8601DateFormatter()
      for rh in remote.hosts {
        if !store.hosts.contains(where: { $0.id.uuidString == rh.id }) {
          let host = Host(
            id: UUID(uuidString: rh.id) ?? UUID(),
            label: rh.label, address: rh.address, port: rh.port,
            username: rh.username,
            authMethod: AuthMethod(rawValue: rh.authMethod) ?? .password,
            tags: rh.tags, colorHex: rh.colorHex, notes: rh.notes,
            lastConnectedAt: rh.lastConnectedAt.flatMap { iso.date(from: $0) },
            createdAt: iso.date(from: rh.updatedAt) ?? Date(),
            updatedAt: iso.date(from: rh.updatedAt) ?? Date()
          )
          store.addHost(host)
        }
      }
      for rs in remote.snippets {
        if !store.snippets.contains(where: { $0.id.uuidString == rs.id }) {
          let snippet = Snippet(
            id: UUID(uuidString: rs.id) ?? UUID(),
            label: rs.label, command: rs.command,
            description: rs.description, tags: rs.tags,
            createdAt: iso.date(from: rs.createdAt) ?? Date()
          )
          store.addSnippet(snippet)
        }
      }
    } catch {
      print("[BackgroundSyncManager] syncAll error: \(error)")
    }
  }

  /// Schedule a background sync task (runs every 15 minutes minimum on iOS)
  func scheduleBackgroundSync() {
    let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes minimum

    do {
      try BGTaskScheduler.shared.submit(request)
      isSyncScheduled = true
      nextSyncTime = request.earliestBeginDate
      print("[BackgroundSyncManager] Background sync scheduled for \(String(describing: request.earliestBeginDate))")
    } catch {
      print("[BackgroundSyncManager] Failed to schedule background sync: \(error)")
      isSyncScheduled = false
    }
  }

  /// Register background sync task handler (call from AppDelegate.application(_:didFinishLaunchingWithOptions:))
  static func registerBackgroundTasks() {
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: shared.taskIdentifier,
      using: DispatchQueue.main
    ) { task in
      let bgTask = task as! BGAppRefreshTask
      shared.performBackgroundSync(bgTask)
    }
  }

  /// Perform the actual background sync
  private func performBackgroundSync(_ bgTask: BGAppRefreshTask) {
    // Set expiration handler
    bgTask.expirationHandler = {
      print("[BackgroundSyncManager] Background task expired")
      self.scheduleBackgroundSync()
    }

    Task {
      do {
        // Sync data with 30-second timeout
        try await withThrowingTask(timeout: 30) {
          await self.syncAll(store: self.appStore)
        }

        lastSyncTime = Date()
        print("[BackgroundSyncManager] Background sync completed successfully")
        bgTask.setTaskCompleted(success: true)
      } catch {
        print("[BackgroundSyncManager] Background sync failed: \(error)")
        bgTask.setTaskCompleted(success: false)
      }

      // Reschedule next sync
      scheduleBackgroundSync()
    }
  }

  /// Perform sync immediately when app enters foreground
  func syncOnForeground() {
    Task {
      await syncAll(store: appStore)
      lastSyncTime = Date()
    }
  }

  /// Perform sync when network becomes available
  func syncOnNetworkAvailable() {
    Task {
      await syncAll(store: appStore)
      lastSyncTime = Date()
    }
  }

  /// Manual sync trigger
  func performManualSync() async {
    await syncAll(store: appStore)
    lastSyncTime = Date()
  }
}

// Helper for timeout handling
private func withThrowingTask<T>(timeout: TimeInterval, _ operation: @escaping () async throws -> T) async throws -> T {
  return try await withThrowingTaskGroup(of: T.self) { group in
    group.addTask {
      try await operation()
    }

    group.addTask {
      try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
      throw CancellationError()
    }

    return try await group.next()!
  }
}

// Network state observer - requires Reachability package (not yet added)
// final class NetworkStateObserver: NSObject, @unchecked Sendable {
//   private let reachability = try? Reachability()
//   var onNetworkAvailable: (() -> Void)?
//   ...
// }
#endif
