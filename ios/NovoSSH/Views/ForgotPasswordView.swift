import SwiftUI

struct ForgotPasswordView: View {
    @EnvironmentObject private var api: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var isLoading = false
    @State private var sent = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()
                VStack(spacing: 28) {
                    VStack(spacing: 10) {
                        Image(systemName: "key.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(Theme.accent)
                        Text("Reset Password")
                            .font(.title2.bold())
                            .foregroundStyle(Theme.textStrong)
                        Text("Enter your email and we'll send a reset link.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)

                    if sent {
                        VStack(spacing: 12) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(Theme.accent)
                            Text("Check your inbox")
                                .font(.headline)
                                .foregroundStyle(Theme.textStrong)
                            Text("If an account exists for \(email), a reset link has been sent. Check your spam folder too.")
                                .font(.subheadline)
                                .foregroundStyle(Theme.textMuted)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 24)
                    } else {
                        VStack(spacing: 16) {
                            HStack(spacing: 12) {
                                Image(systemName: "envelope")
                                    .foregroundStyle(Theme.textMuted)
                                    .frame(width: 20)
                                TextField("Email", text: $email)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                                    .foregroundStyle(Theme.textStrong)
                                    .textContentType(.emailAddress)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Theme.panel)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.stroke))

                            if let err = errorMessage {
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                                    Text(err).font(.caption).foregroundStyle(.red)
                                }
                            }

                            Button(action: send) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.accent)
                                    if isLoading {
                                        ProgressView().tint(Theme.bg)
                                    } else {
                                        Text("Send Reset Link")
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(Theme.bg)
                                    }
                                }
                                .frame(height: 50)
                            }
                            .disabled(isLoading || email.isEmpty)
                            .opacity(email.isEmpty ? 0.5 : 1)
                        }
                        .padding(.horizontal, 24)
                    }

                    Spacer()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
                if sent {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Done") { dismiss() }
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
        }
    }

    private func send() {
        errorMessage = nil
        isLoading = true
        Task {
            do {
                try await api.forgotPassword(email: email)
                sent = true
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
