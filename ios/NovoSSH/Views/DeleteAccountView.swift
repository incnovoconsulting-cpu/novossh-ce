import SwiftUI

struct DeleteAccountView: View {
    @ObservedObject var api: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var confirmationText = ""
    @State private var isDeleting = false
    @State private var error: String?

    private let confirmationPhrase = "DELETE"

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title2)
                            .foregroundStyle(.red)
                        Text("This permanently deletes your account and all associated data — hosts, vault entries, snippets, keys, session history, and subscription. This cannot be undone.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textStrong.opacity(0.8))
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Theme.panel)

                Section("Confirm your password") {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
                .listRowBackground(Theme.panel)

                Section("Type \(confirmationPhrase) to confirm") {
                    TextField(confirmationPhrase, text: $confirmationText)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                }
                .listRowBackground(Theme.panel)

                if let error {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                    .listRowBackground(Theme.panel)
                }

                Section {
                    Button(role: .destructive) {
                        Task { await deleteAccount() }
                    } label: {
                        HStack {
                            if isDeleting { ProgressView().tint(.red) }
                            Text("Permanently Delete Account")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(confirmationText != confirmationPhrase || isDeleting)
                }
                .listRowBackground(Theme.panel)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        error = nil
        do {
            try await api.deleteAccount(password: password)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isDeleting = false
    }
}
