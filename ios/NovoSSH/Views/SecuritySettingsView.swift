import SwiftUI
import SafariServices
import AuthenticationServices

struct SecuritySettingsView: View {
    @EnvironmentObject private var paywall: PaywallService
    @StateObject private var service = SecurityService.shared
    @State private var showAddPasskey = false
    @State private var showPaywall = false
    @State private var showSAMLSheet = false
    @State private var renamingCredential: PasskeyCredential?
    @State private var deleteConfirmCredential: PasskeyCredential?

    var body: some View {
        ZStack { Theme.bg.ignoresSafeArea() }
            .overlay {
                if !paywall.canAccess(.mfa) {
                    // Full-screen paywall within navigation context
                    VStack(spacing: 20) {
                        Image(systemName: "faceid")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.accent)
                        Text("MFA / Security Keys")
                            .font(.title2.bold())
                            .foregroundStyle(Theme.textStrong)
                        Text("Protect your account with passkeys and security keys.\nRequires the Starter plan or higher.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.textMuted)
                        Button {
                            showPaywall = true
                        } label: {
                            Text("Upgrade to Starter")
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.bg)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Theme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .padding(.horizontal, 24)
                    }
                    .padding(32)
                } else {
                    List {
                        passkeySection
                        samlSection
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Security")
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
            .task { if paywall.canAccess(.mfa) { await service.fetchCredentials() } }
            .refreshable { if paywall.canAccess(.mfa) { await service.fetchCredentials() } }
            .sheet(isPresented: $showPaywall) { PaywallSheet(feature: .mfa) }
            .sheet(isPresented: $showAddPasskey) {
                AddPasskeySheet()
            }
            .sheet(isPresented: $showSAMLSheet) {
                SAMLLoginSheet()
            }
            .sheet(item: $renamingCredential) { cred in
                RenameCredentialSheet(credential: cred)
            }
            .confirmationDialog(
                "Delete passkey?",
                isPresented: .constant(deleteConfirmCredential != nil),
                titleVisibility: .visible
            ) {
                if let cred = deleteConfirmCredential {
                    Button("Delete", role: .destructive) {
                        Task { await service.deleteCredential(id: cred.id) }
                        deleteConfirmCredential = nil
                    }
                }
                Button("Cancel", role: .cancel) { deleteConfirmCredential = nil }
            } message: {
                Text("This passkey will be removed from your account.")
            }
            .alert("Error", isPresented: .constant(service.error != nil), presenting: service.error) { _ in
                Button("OK") { service.error = nil }
            } message: { err in Text(err) }
    }

    // MARK: - Passkey section

    private var passkeySection: some View {
        Section {
            if service.isLoading && service.credentials.isEmpty {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.accent)
                    Spacer()
                }
            } else if service.credentials.isEmpty {
                Label("No passkeys registered", systemImage: "key.slash")
                    .foregroundStyle(Theme.textStrong.opacity(0.5))
                    .font(.subheadline)
            } else {
                ForEach(service.credentials) { cred in
                    CredentialRow(credential: cred)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                deleteConfirmCredential = cred
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            Button {
                                renamingCredential = cred
                            } label: {
                                Label("Rename", systemImage: "pencil")
                            }
                            .tint(Theme.accent)
                        }
                }
            }

            Button {
                showAddPasskey = true
            } label: {
                Label("Add Passkey", systemImage: "plus.circle")
                    .foregroundStyle(Theme.accent)
            }
        } header: {
            Label("Passkeys & Security Keys", systemImage: "key.fill")
                .textCase(nil)
        } footer: {
            Text("Passkeys use biometrics or a security key for passwordless authentication.")
                .font(.caption)
                .foregroundStyle(Theme.textStrong.opacity(0.4))
        }
        .listRowBackground(Theme.panel)
    }

    // MARK: - SAML section

    private var samlSection: some View {
        Section {
            Button {
                showSAMLSheet = true
            } label: {
                HStack {
                    Label("Sign In with SSO", systemImage: "building.columns")
                        .foregroundStyle(Theme.textStrong)
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.4))
                }
            }
        } header: {
            Label("SAML Single Sign-On", systemImage: "shield.lefthalf.filled")
                .textCase(nil)
        } footer: {
            Text("Connect your organization's identity provider (Okta, Azure AD, Google Workspace, etc.).")
                .font(.caption)
                .foregroundStyle(Theme.textStrong.opacity(0.4))
        }
        .listRowBackground(Theme.panel)
    }
}

// MARK: - Credential row

private struct CredentialRow: View {
    let credential: PasskeyCredential

    private var transportIcon: String {
        guard let t = credential.transports?.first else { return "key" }
        switch t {
        case "internal": return "faceid"
        case "usb": return "cable.connector"
        case "nfc": return "wave.3.right"
        case "ble": return "wave.3.right"
        default: return "key"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transportIcon)
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 3) {
                Text(credential.name ?? "Unnamed Passkey")
                    .font(.body)
                    .foregroundStyle(Theme.textStrong)
                HStack(spacing: 6) {
                    Text("Added \(relativeDate(credential.created_at))")
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.4))
                    if let lastUsed = credential.last_used_at {
                        Text("·")
                            .foregroundStyle(Theme.textStrong.opacity(0.3))
                        Text("Used \(relativeDate(lastUsed))")
                            .font(.caption)
                            .foregroundStyle(Theme.textStrong.opacity(0.4))
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func relativeDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) else { return iso.prefix(10).description }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .short
        return rel.localizedString(for: date, relativeTo: .now)
    }
}

// MARK: - Add passkey sheet

struct AddPasskeySheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = SecurityService.shared
    @State private var passkeyName = ""
    @State private var isRegistering = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Passkey name (e.g. Face ID, YubiKey)", text: $passkeyName)
                } header: {
                    Text("Name your passkey")
                } footer: {
                    Text("A passkey uses Face ID, Touch ID, or a hardware security key to verify your identity.")
                }

                if #available(iOS 16.0, *) {
                    Section {
                        infoRow(icon: "faceid", text: "Device passkey (Face ID / Touch ID)")
                        infoRow(icon: "cable.connector", text: "Security key (USB/NFC/Bluetooth)")
                    } header: { Text("Supported methods") }
                } else {
                    Section {
                        Label("Passkeys require iOS 16 or later. Register via the web app.", systemImage: "exclamationmark.triangle")
                            .font(.callout)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Add Passkey")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if #available(iOS 16.0, *) {
                        Button("Register") { Task { await startRegistration() } }
                            .disabled(passkeyName.isEmpty || isRegistering)
                    }
                }
            }
            .overlay {
                if isRegistering {
                    ZStack {
                        Color.black.opacity(0.4).ignoresSafeArea()
                        ProgressView("Registering…").tint(Theme.accent)
                            .padding(24).background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }

    private func infoRow(icon: String, text: String) -> some View {
        Label(text, systemImage: icon).foregroundStyle(Theme.textStrong).font(.subheadline)
    }

    @available(iOS 16.0, *)
    private func startRegistration() async {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else { return }
        isRegistering = true
        await service.registerPasskey(name: passkeyName, presentingOn: window)
        isRegistering = false
        if service.error == nil { dismiss() }
    }
}

// MARK: - Rename credential sheet

struct RenameCredentialSheet: View {
    let credential: PasskeyCredential
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = SecurityService.shared
    @State private var newName: String

    init(credential: PasskeyCredential) {
        self.credential = credential
        _newName = State(initialValue: credential.name ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Passkey name", text: $newName)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Rename Passkey")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await service.renameCredential(id: credential.id, name: newName)
                            dismiss()
                        }
                    }
                    .disabled(newName.isEmpty)
                }
            }
        }
    }
}

// MARK: - SAML login sheet

struct SAMLLoginSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = SecurityService.shared
    @State private var organizationId = ""
    @State private var isLoading = false
    @State private var safariURL: IdentifiableURL?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Organization ID or slug", text: $organizationId)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("Organization")
                } footer: {
                    Text("Your administrator will provide the organization ID for your identity provider.")
                }

                Section {
                    Button {
                        Task { await initiateSSO() }
                    } label: {
                        HStack {
                            Spacer()
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Label("Continue with SSO", systemImage: "arrow.right.circle.fill")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(organizationId.isEmpty || isLoading)
                    .listRowBackground(Theme.accent)
                    .foregroundStyle(.black)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("SAML SSO")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .fullScreenCover(item: $safariURL) { item in
            SafariView(url: item.url)
        }
    }

    private func initiateSSO() async {
        isLoading = true
        defer { isLoading = false }
        if let url = await service.samlLoginURL(organizationId: organizationId) {
            safariURL = IdentifiableURL(url: url)
        }
    }
}

// MARK: - Safari wrapper


struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }
    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}
