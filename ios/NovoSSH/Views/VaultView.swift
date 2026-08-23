import SwiftUI

struct VaultView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var paywall: PaywallService
    @EnvironmentObject private var addTrigger: AddItemTrigger
    @State private var selectedVault: Vault?
    @State private var showCreateVault = false
    @State private var showCreateEntry = false
    @State private var showVaultPin = false
    @State private var pendingVault: Vault?
    @State private var showPaywall = false

    var body: some View {
        Group {
            if let vault = selectedVault {
                VaultDetailView(vault: vault, onBack: { selectedVault = nil })
            } else if store.vaults.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "lock.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.accentColor.opacity(0.4))
                    Text("No vaults yet")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    Text("Create a vault to store credentials securely")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
            } else {
                List {
                    ForEach(store.vaults) { vault in
                        Button {
                            if store.isPinSet {
                                pendingVault = vault
                                showVaultPin = true
                            } else {
                                selectedVault = vault
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "lock.fill")
                                    .foregroundStyle(Color.accentColor)
                                    .frame(width: 24)
                                VStack(alignment: .leading) {
                                    Text(vault.name).font(.headline)
                                    if let desc = vault.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                }
                                Spacer()
                                if store.isPinSet {
                                    Image(systemName: "lock.fill")
                                        .font(.caption)
                                        .foregroundStyle(.tertiary)
                                }
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(.tertiary)
                                    .font(.caption)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button("Delete", role: .destructive) { store.deleteVault(vault.id) }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Vault")
        .onChange(of: addTrigger.vault) { _, _ in
            if paywall.canAddVault(currentCount: store.vaults.count) {
                showCreateVault = true
            } else {
                showPaywall = true
            }
        }
        .sheet(isPresented: $showCreateVault) {
            CreateVaultSheet(isPresented: $showCreateVault)
        }
        .sheet(isPresented: $showPaywall) {
            PaywallSheet(feature: .unlimitedVaults)
        }
        .sheet(isPresented: $showVaultPin) {
            PinLockView(isSetup: false) {
                if let vault = pendingVault {
                    selectedVault = vault
                }
                showVaultPin = false
                pendingVault = nil
            }
        }
    }
}

struct VaultDetailView: View {
    @EnvironmentObject private var store: AppStore
    let vault: Vault
    let onBack: () -> Void
    @State private var showCreateEntry = false
    @State private var showUseEntry = false
    @State private var selectedEntry: VaultEntry?

    private var entries: [VaultEntry] { store.entries(for: vault.id) }

    private func typeDetail(for entry: VaultEntry) -> String? {
        guard let data = entry.encryptedData.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return nil
        }
        switch entry.type {
        case "HOST": return json["address"]
        case "CREDENTIAL": return json["username"]
        case "KEY": return "Private key"
        case "NOTE": return json["content"]
        default: return nil
        }
    }

    var body: some View {
        List {
            if entries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("No entries").font(.headline).foregroundStyle(.secondary)
                    Text("Tap + to add credentials").font(.caption).foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                ForEach(entries) { entry in
                    Button {
                        selectedEntry = entry
                        showUseEntry = true
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: entry.icon)
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 24)
                            VStack(alignment: .leading) {
                                Text(entry.name).font(.headline)
                                Text(entry.type.lowercased().capitalized)
                                    .font(.caption).foregroundStyle(.secondary)
                                if let detail = typeDetail(for: entry) {
                                    Text(detail)
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                        .lineLimit(1)
                                }
                            }
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button("Delete", role: .destructive) {
                            store.deleteEntry(entry.id, from: vault.id)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle(vault.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button { onBack() } label: {
                    Image(systemName: "chevron.left")
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button { showCreateEntry = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateEntry) {
            CreateVaultEntrySheet(vaultId: vault.id, isPresented: $showCreateEntry)
        }
        .sheet(isPresented: $showUseEntry) {
            if let entry = selectedEntry {
                UseVaultEntrySheet(entry: entry, vault: vault, isPresented: $showUseEntry)
            }
        }
    }
}

struct CreateVaultSheet: View {
    @EnvironmentObject private var store: AppStore
    @Binding var isPresented: Bool
    @State private var name = ""
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Vault Details") {
                    TextField("Name", text: $name)
                    TextField("Description (optional)", text: $description)
                }
            }
            .navigationTitle("Create Vault")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        store.addVault(Vault(name: name, description: description.isEmpty ? nil : description))
                        isPresented = false
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

struct CreateVaultEntrySheet: View {
    @EnvironmentObject private var store: AppStore
    let vaultId: UUID
    @Binding var isPresented: Bool
    @State private var type = "HOST"
    @State private var name = ""
    @State private var hostAddress = ""
    @State private var username = ""
    @State private var password = ""
    @State private var keyData = ""
    @State private var noteContent = ""

    private let types = ["HOST", "CREDENTIAL", "KEY", "NOTE"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry Type") {
                    Picker("Type", selection: $type) {
                        ForEach(types, id: \.self) {
                            Label($0.lowercased().capitalized, systemImage: iconForType($0))
                        }
                    }
                    .pickerStyle(.segmented)
                }

                switch type {
                case "HOST":
                    Section("Host Details") {
                        TextField("Label", text: $name)
                        TextField("Address (IP or hostname)", text: $hostAddress)
                            .textContentType(.URL)
                            .autocorrectionDisabled()
                    }
                case "CREDENTIAL":
                    Section("Credential Details") {
                        TextField("Label", text: $name)
                        TextField("Username / Email", text: $username)
                            .textContentType(.username)
                            .autocorrectionDisabled()
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                    }
                case "KEY":
                    Section("Key Details") {
                        TextField("Label", text: $name)
                        TextEditor(text: $keyData)
                            .font(.system(.body, design: .monospaced))
                            .frame(height: 120)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.secondary.opacity(0.2))
                            )
                    }
                case "NOTE":
                    Section("Note Details") {
                        TextField("Title", text: $name)
                        TextEditor(text: $noteContent)
                            .frame(height: 120)
                    }
                default:
                    EmptyView()
                }
            }
            .navigationTitle("Add Entry")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let entry = buildEntry()
                        store.addEntry(entry, to: vaultId)
                        isPresented = false
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func buildEntry() -> VaultEntry {
        let encryptedData: String
        switch type {
        case "HOST":
            encryptedData = "{\"address\":\"\(hostAddress)\"}"
        case "CREDENTIAL":
            encryptedData = "{\"username\":\"\(username)\",\"password\":\"\(password)\"}"
        case "KEY":
            encryptedData = "{\"keyData\":\"\(keyData.replacingOccurrences(of: "\"", with: "\\\""))\"}"
        case "NOTE":
            encryptedData = "{\"content\":\"\(noteContent.replacingOccurrences(of: "\"", with: "\\\""))\"}"
        default:
            encryptedData = "{}"
        }
        return VaultEntry(vaultId: vaultId, type: type, name: name, encryptedData: encryptedData)
    }

    private func iconForType(_ type: String) -> String {
        switch type {
        case "HOST": return "desktopcomputer"
        case "CREDENTIAL": return "lock.fill"
        case "KEY": return "key.fill"
        default: return "doc.text"
        }
    }
}

struct UseVaultEntrySheet: View {
    @EnvironmentObject private var store: AppStore
    let entry: VaultEntry
    let vault: Vault
    @Binding var isPresented: Bool

    var body: some View {
        NavigationStack {
            List {
                Section("Entry Info") {
                    LabeledContent("Name", value: entry.name)
                    LabeledContent("Type", value: entry.type)
                    if let detail = typeDetail {
                        LabeledContent("Detail", value: detail)
                    }
                }

                Section("Actions") {
                    switch entry.type {
                    case "HOST":
                        Button {
                            addHostFromEntry()
                            isPresented = false
                        } label: {
                            Label("Add as Host", systemImage: "plus.circle")
                        }

                    case "CREDENTIAL":
                        Button {
                            copyToClipboard(typeDetail ?? "")
                            isPresented = false
                        } label: {
                            Label("Copy Username", systemImage: "doc.on.doc")
                        }
                        Button {
                            if let data = jsonData, let pw = data["password"] {
                                copyToClipboard(pw)
                            }
                            isPresented = false
                        } label: {
                            Label("Copy Password", systemImage: "lock.fill")
                        }

                    case "KEY":
                        Button {
                            addKeyFromEntry()
                            isPresented = false
                        } label: {
                            Label("Add as Identity Key", systemImage: "key.fill")
                        }

                    case "NOTE":
                        Button {
                            copyToClipboard(jsonData?["content"] ?? "")
                            isPresented = false
                        } label: {
                            Label("Copy Note", systemImage: "doc.on.doc")
                        }

                    default:
                        EmptyView()
                    }
                }
            }
            .navigationTitle("Use Entry")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { isPresented = false }
                }
            }
        }
    }

    private var jsonData: [String: String]? {
        guard let data = entry.encryptedData.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return nil
        }
        return json
    }

    private var typeDetail: String? {
        switch entry.type {
        case "HOST": return jsonData?["address"]
        case "CREDENTIAL": return jsonData?["username"]
        case "KEY": return "Private key"
        case "NOTE": return jsonData?["content"]
        default: return nil
        }
    }

    private func addHostFromEntry() {
        guard let addr = jsonData?["address"] else { return }
        let host = Host(label: entry.name, address: addr, username: "root", authMethod: .password)
        store.addHost(host, password: nil)
    }

    private func addKeyFromEntry() {
        guard let keyData = jsonData?["keyData"] else { return }
        let key = IdentityKey(label: entry.name, privateKey: keyData)
        store.addKey(key, privateKeyPEM: keyData)
    }

    private func copyToClipboard(_ text: String) {
        #if os(iOS)
        UIPasteboard.general.string = text
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #endif
    }
}
