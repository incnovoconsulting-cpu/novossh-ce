import SwiftUI

private let availableFonts = ["Monospace", "Sans Serif", "Serif", "Default"]
private let availableKeys = [
    "Tab", "Esc", "^C", "^D", "^Z", "^L", "^[",
    "↑", "↓", "←", "→", "Home", "End", "PgUp", "PgDn",
    "Ins", "Del", "F1", "F2", "F3", "F4",
    "|", "/", "~", "-", "_", ":", ".",
]

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var biometric: BiometricAuthService
    @EnvironmentObject private var api: APIService
    @State private var draft = UserSettings()
    @State private var apiURLDraft = ""
    @State private var showLoginSheet = false
    @State private var showFontPicker = false
    @State private var showKeyboardConfig = false
    @State private var showPinSetup = false
    @State private var showChangePasswordSheet = false
    @State private var profile: APIService.Profile?
    @State private var syncMessage: String?

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            Form {
                Section("Terminal theme") {
                    ForEach(TerminalPalette.all, id: \.id) { p in
                        Button {
                            draft.themeId = p.id
                            commit()
                        } label: {
                            HStack(spacing: 12) {
                                preview(for: p)
                                    .frame(width: 56, height: 32)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                Text(p.name).foregroundStyle(.white)
                                Spacer()
                                if draft.themeId == p.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                        }
                        .listRowBackground(Theme.panel)
                    }
                }

                Section("Appearance") {
                    Stepper("Font size: \(draft.fontSize)pt",
                            value: Binding(get: { draft.fontSize },
                                           set: { draft.fontSize = $0; commit() }),
                            in: 8...32)
                        .listRowBackground(Theme.panel)

                    Button { showFontPicker = true } label: {
                        HStack {
                            Text("Font family")
                            Spacer()
                            Text(draft.fontFamily).foregroundStyle(Theme.accent)
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                    }
                    .listRowBackground(Theme.panel)

                    Toggle("Cursor blink", isOn: Binding(
                        get: { draft.cursorBlink },
                        set: { draft.cursorBlink = $0; commit() }
                    )).listRowBackground(Theme.panel)
                }

                Section("Behavior") {
                    Toggle("Copy on selection", isOn: Binding(
                        get: { draft.copyOnSelect },
                        set: { draft.copyOnSelect = $0; commit() }
                    )).listRowBackground(Theme.panel)

                    Toggle("Bell sound", isOn: Binding(
                        get: { draft.bellSound },
                        set: { draft.bellSound = $0; commit() }
                    )).listRowBackground(Theme.panel)

                    Toggle("Send on Enter", isOn: Binding(
                        get: { draft.sendOnEnter },
                        set: { draft.sendOnEnter = $0; commit() }
                    )).listRowBackground(Theme.panel)

                    Stepper("Scrollback: \(draft.scrollback) lines",
                            value: Binding(get: { draft.scrollback },
                                           set: { draft.scrollback = $0; commit() }),
                            in: 500...50000, step: 500)
                        .listRowBackground(Theme.panel)
                    Stepper("Keepalive: \(draft.keepAliveSeconds)s",
                            value: Binding(get: { draft.keepAliveSeconds },
                                           set: { draft.keepAliveSeconds = $0; commit() }),
                            in: 0...300, step: 5)
                        .listRowBackground(Theme.panel)
                }

                Section("Keyboard Add-on") {
                    Button { showKeyboardConfig = true } label: {
                        HStack {
                            Text("Customize keys")
                            Spacer()
                            Text("\(selectedKeys.count) keys").foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                    }
                    .listRowBackground(Theme.panel)
                }

                Section("Security") {
                    Toggle(isOn: $store.isPinSet) {
                        Label("App PIN Lock", systemImage: "lock.fill")
                            .foregroundStyle(.white)
                    }
                    .listRowBackground(Theme.panel)
                    .onChange(of: store.isPinSet) { oldValue, newValue in
                        if newValue && !oldValue {
                            showPinSetup = true
                        } else if !newValue {
                            store.isAppLocked = false
                        }
                    }

                    if biometric.isAvailable {
                        Toggle(isOn: $store.requiresBiometricLock) {
                            Label("Require \(biometric.biometryName)", systemImage: "faceid")
                                .foregroundStyle(.white)
                        }
                        .listRowBackground(Theme.panel)
                    }
                }

                if api.isLoggedIn {
                    Section("Account") {
                        if let profile {
                            LabeledContent("Email", value: profile.email)
                                .foregroundStyle(.white)
                            // The server serializes Postgres timestamps via Date.toISOString(),
                            // which always includes fractional seconds — the default
                            // ISO8601DateFormatter (no options) fails to parse that and
                            // silently returns nil, so this must opt in explicitly.
                            if let date = parseISO8601(profile.createdAt) {
                                LabeledContent("Member since", value: date.formatted(date: .abbreviated, time: .omitted))
                                    .foregroundStyle(.white)
                            }
                            if !profile.isOAuthAccount {
                                Button { showChangePasswordSheet = true } label: {
                                    Label("Change Password", systemImage: "key")
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                        } else {
                            ProgressView().frame(maxWidth: .infinity)
                        }
                    }
                    .listRowBackground(Theme.panel)
                    .task { profile = try? await api.getProfile() }
                }

                Section("Cloud Sync") {

                    if api.isLoggedIn {
                        Button {
                            Task {
                                do {
                                    // Preflight check runs inside sync() before push.
                                    let remote = try await api.sync(
                                        localHosts: store.hosts,
                                        localKeys: store.keys,
                                        localSnippets: store.snippets
                                    )
                                    store.mergeFromRemote(
                                        hosts: remote.hosts,
                                        keys: remote.keys,
                                        snippets: remote.snippets
                                    )
                                    let limit = api.planLimits?.hosts ?? 3
                                    let localCount = store.hosts.count
                                    if localCount > limit {
                                        syncMessage = "Synced \(limit) of \(localCount) hosts — \(remote.plan?.capitalized ?? "Free") plan limit is \(limit). Upgrade to sync all."
                                    } else {
                                        syncMessage = "Synced \(remote.hosts.count) hosts, \(remote.snippets.count) snippets"
                                    }
                                } catch {
                                    if let urlError = error as? URLError,
                                       urlError.code == .badServerResponse,
                                       let msg = urlError.userInfo[NSLocalizedDescriptionKey] as? String,
                                       msg.contains("401") {
                                        syncMessage = "Session expired. Please sign out and sign back in."
                                    } else {
                                        syncMessage = error.localizedDescription
                                    }
                                }
                            }
                        } label: {
                            HStack {
                                Label("Sync now", systemImage: "arrow.triangle.2.circlepath")
                                    .foregroundStyle(Theme.accent)
                                if api.isSyncing { Spacer(); ProgressView() }
                            }
                        }
                        .listRowBackground(Theme.panel)

                        if let msg = syncMessage {
                            Text(msg).font(.caption).foregroundStyle(.white.opacity(0.6))
                                .listRowBackground(Theme.panel)
                        }
                        // Delete Account lives in the hamburger Menu next to Sign Out
                        // (single, discoverable location) — see HamburgerMenuSheet.
                    } else {
                        Button { showLoginSheet = true } label: {
                            Label("Sign in to sync", systemImage: "person.crop.circle.badge.plus")
                                .foregroundStyle(Theme.accent)
                        }
                        .listRowBackground(Theme.panel)
                    }
                }

                Section("Support") {
                    Button {
                        if let url = URL(string: "mailto:support@novossh.com") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Email Support", systemImage: "envelope")
                            .foregroundStyle(Theme.accent)
                    }
                    .listRowBackground(Theme.panel)
                }

                Section("About") {
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.11.0")
                        .foregroundStyle(.white)
                        .listRowBackground(Theme.panel)
                    Text("NovoSSH is a modern SSH client. Credentials are stored in the iOS Keychain.")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.55))
                        .listRowBackground(Theme.panel)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Settings")
        .onAppear {
            draft = store.settings
            apiURLDraft = api.baseURL
            biometric.refreshBiometryType()
        }
        .sheet(isPresented: $showLoginSheet) {
            APILoginView()
        }
        .sheet(isPresented: $showFontPicker) {
            FontPickerSheet(currentFont: draft.fontFamily) { font in
                draft.fontFamily = font
                commit()
            }
        }
        .sheet(isPresented: $showKeyboardConfig) {
            KeyboardConfigSheet(selectedKeys: selectedKeys) { keys in
                draft.keyboardButtons = keys.joined(separator: ",")
                commit()
            }
        }
        .sheet(isPresented: $showPinSetup) {
            PinLockView(isSetup: true) { showPinSetup = false }
        }
        .sheet(isPresented: $showChangePasswordSheet) {
            ChangePasswordView(api: api, isOAuthAccount: profile?.isOAuthAccount ?? false)
        }
    }

    private var selectedKeys: [String] {
        draft.keyboardButtons.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private func parseISO8601(_ string: String) -> Date? {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions.insert(.withFractionalSeconds)
        return withFractional.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }

    private func commit() { store.updateSettings(draft) }

    private func preview(for p: TerminalPalette) -> some View {
        ZStack {
            Color(hex: p.backgroundHex)
            HStack(spacing: 3) {
                Circle().fill(Color(hex: p.ansiHex[1])).frame(width: 8, height: 8)
                Circle().fill(Color(hex: p.ansiHex[2])).frame(width: 8, height: 8)
                Circle().fill(Color(hex: p.ansiHex[4])).frame(width: 8, height: 8)
            }
        }
    }
}

struct FontPickerSheet: View {
    let currentFont: String
    let onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(availableFonts, id: \.self) { font in
                Button { onSelect(font); dismiss() } label: {
                    HStack {
                        Text(font)
                            .font(font == "Monospace" ? .system(.body, design: .monospaced) :
                                  font == "Serif" ? .system(.body, design: .serif) :
                                  font == "Sans Serif" ? .system(.body, design: .rounded) :
                                  .body)
                        Spacer()
                        if font == currentFont {
                            Image(systemName: "checkmark").foregroundStyle(Theme.accent)
                        }
                    }
                }
            }
            .navigationTitle("Terminal Font")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

struct KeyboardConfigSheet: View {
    let selectedKeys: [String]
    let onSave: ([String]) -> Void
    @State private var selected: Set<String>
    @Environment(\.dismiss) private var dismiss

    init(selectedKeys: [String], onSave: @escaping ([String]) -> Void) {
        self.selectedKeys = selectedKeys
        self.onSave = onSave
        _selected = State(initialValue: Set(selectedKeys))
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Select keys to show in terminal toolbar") {
                    ForEach(availableKeys, id: \.self) { key in
                        Button {
                            if selected.contains(key) { selected.remove(key) }
                            else { selected.insert(key) }
                        } label: {
                            HStack {
                                Text(key)
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundStyle(.white)
                                Spacer()
                                if selected.contains(key) {
                                    Image(systemName: "checkmark").foregroundStyle(Theme.accent)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Keyboard Keys")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(Array(selected)); dismiss() }
                }
            }
        }
    }
}
