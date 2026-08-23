import SwiftUI

struct ChangePasswordView: View {
    @ObservedObject var api: APIService
    let isOAuthAccount: Bool
    @Environment(\.dismiss) private var dismiss

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var didSucceed = false

    private var canSubmit: Bool {
        newPassword.count >= 8 && newPassword == confirmPassword && (isOAuthAccount || !currentPassword.isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                if !isOAuthAccount {
                    Section("Current password") {
                        SecureField("Current password", text: $currentPassword)
                            .textContentType(.password)
                    }
                    .listRowBackground(Theme.panel)
                }

                Section("New password") {
                    SecureField("New password", text: $newPassword)
                        .textContentType(.newPassword)
                    SecureField("Confirm new password", text: $confirmPassword)
                        .textContentType(.newPassword)
                    if !newPassword.isEmpty && newPassword.count < 8 {
                        Text("Password must be at least 8 characters.")
                            .font(.caption).foregroundStyle(.orange)
                    }
                    if !confirmPassword.isEmpty && newPassword != confirmPassword {
                        Text("Passwords don't match.")
                            .font(.caption).foregroundStyle(.orange)
                    }
                }
                .listRowBackground(Theme.panel)

                if let error {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                    .listRowBackground(Theme.panel)
                }

                if didSucceed {
                    Section {
                        Label("Password updated", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .listRowBackground(Theme.panel)
                }

                Section {
                    Button {
                        Task { await changePassword() }
                    } label: {
                        HStack {
                            if isSaving { ProgressView() }
                            Text("Update Password")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(!canSubmit || isSaving)
                }
                .listRowBackground(Theme.panel)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Change Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func changePassword() async {
        isSaving = true
        error = nil
        do {
            try await api.changePassword(currentPassword: currentPassword, newPassword: newPassword)
            didSucceed = true
            currentPassword = ""; newPassword = ""; confirmPassword = ""
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}
