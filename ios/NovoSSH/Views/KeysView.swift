import SwiftUI
import UniformTypeIdentifiers

struct KeysView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var paywall: PaywallService
    @EnvironmentObject private var addTrigger: AddItemTrigger
    @State private var showNew = false
    @State private var showPaywall = false

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            List {
                if store.keys.isEmpty {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Your keychain is empty.")
                                .foregroundStyle(.white.opacity(0.85))
                            Text("Import a private key to use key-based auth on your hosts. Keys are stored locally on this device.")
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.55))
                        }
                        .listRowBackground(Theme.panel)
                    }
                }
                ForEach(store.keys) { k in
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Theme.accent.opacity(0.12))
                                .frame(width: 38, height: 38)
                            Image(systemName: "key.fill")
                                .foregroundStyle(Theme.accent)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(k.label).foregroundStyle(.white)
                            Text("\(k.hasPassphrase ? "Encrypted" : "Unencrypted") · added \(k.createdAt.relativeShort)")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.55))
                        }
                        Spacer()
                    }
                    .listRowBackground(Theme.panel)
                    .swipeActions {
                        Button(role: .destructive) {
                            store.deleteKey(k.id)
                        } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Keychain")
        .onChange(of: addTrigger.key) { _, _ in
            if paywall.canAddKey(currentCount: store.keys.count) {
                showNew = true
            } else {
                showPaywall = true
            }
        }
        .sheet(isPresented: $showPaywall) { PaywallSheet(feature: .unlimitedKeys) }
        .sheet(isPresented: $showNew) { NewKeyView() }
    }
}

struct NewKeyView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var privateKey = ""
    @State private var publicKey = ""
    @State private var hasPassphrase = false
    @State private var showImporter = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Label", text: $label)
                    Toggle("Key has a passphrase", isOn: $hasPassphrase)
                }
                Section("Private key") {
                    Button {
                        showImporter = true
                    } label: {
                        Label("Import from file", systemImage: "square.and.arrow.down")
                    }
                    TextField("-----BEGIN OPENSSH PRIVATE KEY-----", text: $privateKey, axis: .vertical)
                        .font(.system(.caption, design: .monospaced))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .lineLimit(6...20)
                }
                Section("Public key (optional)") {
                    TextField("ssh-ed25519 AAAA…", text: $publicKey, axis: .vertical)
                        .font(.system(.caption, design: .monospaced))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .lineLimit(2...6)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Import key")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        store.addKey(IdentityKey(
                            label: label,
                            privateKey: privateKey,
                            publicKey: publicKey.isEmpty ? nil : publicKey,
                            hasPassphrase: hasPassphrase
                        ))
                        dismiss()
                    }
                    .disabled(label.isEmpty || privateKey.isEmpty)
                }
            }
            .fileImporter(isPresented: $showImporter,
                          allowedContentTypes: [.data, .text, .plainText],
                          allowsMultipleSelection: false) { result in
                if case .success(let urls) = result, let url = urls.first {
                    if url.startAccessingSecurityScopedResource() {
                        defer { url.stopAccessingSecurityScopedResource() }
                        if let s = try? String(contentsOf: url, encoding: .utf8) {
                            privateKey = s
                            if label.isEmpty { label = url.lastPathComponent }
                        }
                    }
                }
            }
        }
    }
}
