import SwiftUI

struct APILoginView: View {
    @EnvironmentObject private var api: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            NavigationStack {
                Form {
                    Section("NovoSSH Account") {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .foregroundStyle(.white)
                            .listRowBackground(Theme.panel)
                        SecureField("Password", text: $password)
                            .foregroundStyle(.white)
                            .listRowBackground(Theme.panel)
                    }

                    if let err = errorMessage {
                        Section {
                            Text(err).foregroundStyle(.red).font(.caption)
                                .listRowBackground(Theme.panel)
                        }
                    }

                    Section {
                        Button {
                            signIn()
                        } label: {
                            HStack {
                                Text("Sign in")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Theme.accent)
                                if isLoading { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(isLoading || email.isEmpty || password.isEmpty)
                        .listRowBackground(Theme.panel)
                    }
                }
                .scrollContentBackground(.hidden)
                .navigationTitle("Sign in")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
            }
        }
    }

    private func signIn() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                try await api.login(email: email, password: password)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
