import SwiftUI

struct HostFormView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    let host: Host?
    let onSave: (Host) -> Void
    let onCancel: () -> Void

    @State private var label = ""
    @State private var address = ""
    @State private var portText = "22"
    @State private var username = ""
    @State private var authMethod: AuthMethod = .password
    @State private var password = ""
    @State private var keyId: UUID?
    @State private var passphrase = ""
    @State private var certificate = ""
    @State private var tagsText = ""
    @State private var colorHex: String = "#00e5ff"
    @State private var notes = ""

    private let palette = [
        "#ff3b3b","#f97316","#ffb800","#00ff88",
        "#00e5ff","#8b5cf6","#ec4899","#06b6d4"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Label", text: $label).textInputAutocapitalization(.never)
                    TextField("Address (host or IP)", text: $address)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    TextField("Port", text: $portText).keyboardType(.numberPad)
                    TextField("Username", text: $username).textInputAutocapitalization(.never)
                }

                Section("Authentication") {
                    Picker("Method", selection: $authMethod) {
                        ForEach(AuthMethod.allCases) { m in
                            Text(m.label).tag(m)
                        }
                    }
                    if authMethod == .password {
                        SecureField("Password", text: $password)
                    } else if authMethod == .key {
                        Picker("Private key", selection: $keyId) {
                            Text("None").tag(UUID?.none)
                            ForEach(store.keys) { k in
                                Text(k.label).tag(Optional(k.id))
                            }
                        }
                        if let key = store.key(by: keyId), key.hasPassphrase {
                            SecureField("Passphrase", text: $passphrase)
                        }
                        if store.keys.isEmpty {
                            Text("Import a key in the Keychain tab first.")
                                .font(.footnote).foregroundStyle(.orange)
                        }
                    } else if authMethod == .cert {
                        Picker("Private key", selection: $keyId) {
                            Text("None").tag(UUID?.none)
                            ForEach(store.keys) { k in
                                Text(k.label).tag(Optional(k.id))
                            }
                        }
                        if store.keys.isEmpty {
                            Text("Import a key in the Keychain tab first.")
                                .font(.footnote).foregroundStyle(.orange)
                        }
                        TextEditor(text: $certificate)
                            .font(.caption)
                            .frame(minHeight: 60)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.gray.opacity(0.3))
                            )
                        Text("Paste your OpenSSH certificate (*-cert.pub)")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }

                Section("Organization") {
                    TextField("Tags (comma separated)", text: $tagsText)
                        .textInputAutocapitalization(.never)
                    colorPicker
                }

                Section("Notes") {
                    TextField("Optional", text: $notes, axis: .vertical)
                        .lineLimit(2...6)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle(host == nil ? "New Host" : "Edit Host")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onCancel(); dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(address.isEmpty || username.isEmpty)
                }
            }
            .onAppear(perform: load)
        }
    }

    private var colorPicker: some View {
        HStack {
            Text("Color")
            Spacer()
            ForEach(palette, id: \.self) { hex in
                Circle()
                    .fill(Color(hex: hex))
                    .frame(width: 22, height: 22)
                    .overlay(
                        Circle()
                            .stroke(Color.white, lineWidth: colorHex == hex ? 2 : 0)
                    )
                    .onTapGesture { colorHex = hex }
            }
        }
    }

    private func load() {
        guard let h = host else { return }
        label = h.label
        address = h.address
        portText = String(h.port)
        username = h.username
        authMethod = h.authMethod
        password = h.password ?? ""
        keyId = h.keyId
        passphrase = h.passphrase ?? ""
        certificate = h.certificate ?? ""
        tagsText = h.tags.joined(separator: ", ")
        colorHex = h.colorHex ?? "#00e5ff"
        notes = h.notes ?? ""
    }

    private func save() {
        let tags = tagsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let h = Host(
            id: host?.id ?? UUID(),
            label: label.isEmpty ? address : label,
            address: address,
            port: Int(portText) ?? 22,
            username: username,
            authMethod: authMethod,
            password: authMethod == .password ? password : nil,
            keyId: (authMethod == .key || authMethod == .cert) ? keyId : nil,
            passphrase: (authMethod == .key || authMethod == .cert) ? (passphrase.isEmpty ? nil : passphrase) : nil,
            certificate: authMethod == .cert ? (certificate.isEmpty ? nil : certificate) : nil,
            tags: tags,
            colorHex: colorHex,
            notes: notes.isEmpty ? nil : notes,
            lastConnectedAt: host?.lastConnectedAt,
            createdAt: host?.createdAt ?? Date(),
            updatedAt: Date()
        )
        onSave(h)
        dismiss()
    }
}
