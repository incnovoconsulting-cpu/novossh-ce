import SwiftUI

@main
struct NovoSSHApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var biometric = BiometricAuthService()
    @StateObject private var api = APIService.shared
    @StateObject private var paywall = PaywallService.shared
    @StateObject private var storeKit = StoreKitService.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(biometric)
                .environmentObject(api)
                .environmentObject(paywall)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
        #if !targetEnvironment(macCatalyst)
        .onChange(of: scenePhase) { _, newPhase in
            // Mac Catalyst can't distinguish "window minimized" from "window closed"
            // via scenePhase/UIKit — both report .background — so locking here would
            // also fire on a plain minimize. Real iOS backgrounding (home button, app
            // switcher) is unambiguous, so this stays enabled there; on Catalyst the
            // app instead only re-locks on a genuinely fresh launch (isUnlocked/
            // isAppLocked both default to locked at process start).
            if newPhase == .background {
                if store.requiresBiometricLock { biometric.lock() }
                store.lockApp()
            }
        }
        #endif
        #if targetEnvironment(macCatalyst)
        // `os(macOS)` is never true for a Mac Catalyst app (it reports os(iOS)) — this
        // was previously guarded with `#if os(macOS)` and silently never compiled in,
        // leaving the Mac build with no menu bar commands or default window size at all.
        .commands {
            // Add to `.newItem` rather than replacing it: replacing removes the system
            // "New Window" (⌘N) command, which left a closed window with no way to reopen
            // it (App Review Guideline 4). Keep New Window and add New Connection alongside
            // it on a distinct shortcut.
            CommandGroup(after: .newItem) {
                Button("New Connection") { AddItemTrigger.shared.host = true }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
            }
        }
        .defaultSize(width: 1024, height: 768)
        #endif
    }
}
