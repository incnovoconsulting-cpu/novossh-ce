import Foundation
import LocalAuthentication

/// Wraps LAContext for Face ID / Touch ID authentication.
@MainActor
final class BiometricAuthService: ObservableObject {
    @Published var isUnlocked = false
    @Published var authError: String?
    /// Guards against overlapping evaluations — LockView auto-fires an attempt on
    /// appear and the unlock button fires another; two concurrent LAContext
    /// evaluations cancel each other and surface a spurious error.
    private var isAuthenticating = false

    init() {
        refreshBiometryType()
    }

    /// Recomputed fresh on every access — an LAContext is only valid for a single
    /// evaluation, so this must never reuse a context that already ran a check.
    var isAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// Cached label only; kept fresh via `refreshBiometryType()` rather than a
    /// single init-time check (which can read stale/unavailable on Mac Catalyst
    /// before the app window is fully active).
    @Published private(set) var biometryType: LABiometryType = .none

    var biometryName: String {
        switch biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "Biometrics"
        }
    }

    /// Re-checks biometry availability/type using a fresh context. Call before
    /// showing any biometric-related UI (e.g. on view appear), not just at launch.
    func refreshBiometryType() {
        let ctx = LAContext()
        var error: NSError?
        if ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            biometryType = ctx.biometryType
        }
    }

    func authenticate(reason: String = "Unlock NovoSSH") async -> Bool {
        if isAuthenticating { return false }
        isAuthenticating = true
        authError = nil
        defer { isAuthenticating = false }

        let ctx = LAContext()
        ctx.localizedFallbackTitle = "Enter Passcode"

        // .deviceOwnerAuthentication = biometrics with automatic passcode fallback.
        var error: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            // The device can't satisfy the lock at all (no passcode/biometry, or a
            // hard error). Never trap the user out of their own app — unlock rather
            // than dead-end on a lock that can't be cleared.
            isUnlocked = true
            return true
        }

        do {
            let success = try await ctx.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            if success { isUnlocked = true }
            return success
        } catch let laError as LAError {
            switch laError.code {
            case .userCancel, .appCancel, .systemCancel:
                // User backed out (or the system interrupted, e.g. during a
                // foreground transition) — stay locked, let them retry via the button.
                return false
            case .biometryNotAvailable, .biometryNotEnrolled, .biometryLockout, .passcodeNotSet:
                // Biometry is unusable right now (this is the "LocalAuthentication
                // error 6" the lock screen was trapping on). Don't lock the user out
                // of the app over an unsatisfiable biometric requirement.
                isUnlocked = true
                return true
            default:
                authError = laError.localizedDescription
                return false
            }
        } catch {
            authError = error.localizedDescription
            return false
        }
    }

    func lock() {
        isUnlocked = false
    }
}
