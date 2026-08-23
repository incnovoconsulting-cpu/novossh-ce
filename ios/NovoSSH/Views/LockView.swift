import SwiftUI

/// Shown when `AppStore.requiresBiometricLock` is true and the app is locked.
struct LockView: View {
    @EnvironmentObject private var biometric: BiometricAuthService

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            VStack(spacing: 32) {
                Image(systemName: biometric.biometryType == .faceID ? "faceid" : "touchid")
                    .font(.system(size: 72))
                    .foregroundStyle(Theme.accent)

                VStack(spacing: 8) {
                    Text("NovoSSH is Locked")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text("Authenticate to continue")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                }

                if let error = biometric.authError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                Button {
                    Task { await biometric.authenticate() }
                } label: {
                    Label("Unlock with \(biometric.biometryName)", systemImage: "lock.open.fill")
                        .font(.headline)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(Theme.accent)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding()
        }
        .task {
            biometric.refreshBiometryType()
            _ = await biometric.authenticate()
        }
    }
}
