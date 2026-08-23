import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var biometric: BiometricAuthService
    @EnvironmentObject private var api: APIService
    @EnvironmentObject private var paywall: PaywallService
    @StateObject private var notifications = NotificationService.shared
    @StateObject private var billing = BillingService.shared
    @StateObject private var addTrigger = AddItemTrigger.shared
    @State private var selectedTab: Tab = .hosts
    @State private var showOnboarding = false
    @State private var showMenu = false
    @State private var showNotifications = false
    @State private var showCommandPalette = false
    @State private var paywallFeature: PremiumFeature?

    enum Tab: Hashable { case hosts, vault, snippets, keys, settings }

    var body: some View {
        Group {
            if !api.isLoggedIn {
                AuthView()
            } else if showOnboarding {
                OnboardingView { showOnboarding = false }
            } else if store.isPinSet && store.isAppLocked {
                PinLockView(isSetup: false) { store.unlockApp() }
            } else if store.requiresBiometricLock && !biometric.isUnlocked {
                LockView()
            } else {
                mainContent
            }
        }
        .onAppear {
            if api.isLoggedIn && !store.settings.hasSeenOnboarding {
                showOnboarding = true
            }
        }
        .onChange(of: billing.subscription) { _, sub in
            paywall.sync(from: sub)
        }
        .onChange(of: api.isLoggedIn) { _, loggedIn in
            // Reset navigation/presentation state on every auth transition so a new
            // session always starts on the Hosts tab — never on whatever screen the
            // previous session left open (e.g. the hamburger menu was open when the
            // account was deleted, which otherwise reappears after signing up again).
            selectedTab = .hosts
            showMenu = false
            showNotifications = false
            showCommandPalette = false
            paywallFeature = nil
            if loggedIn {
                Task { await billing.fetchAll() }
            } else {
                // Wipe account-scoped local data on logout so the next account to sign in
                // on this device doesn't inherit the previous user's hosts/keys/vaults.
                store.clearLocalData()
            }
        }
        .task {
            if api.isLoggedIn {
                await billing.fetchAll()
            }
        }
    }

    // Each tab owns its own NavigationStack (rather than one NavigationStack wrapping
    // the whole TabView) so that pushing a destination — e.g. connecting to a terminal
    // from Hosts — only replaces that tab's content. With a single shared outer stack,
    // any push hid the entire TabView (tab bar included), so switching tabs while
    // connected required popping back (disconnecting) first.
    private var mainContent: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HostsView()
                    .toolbar { sharedToolbar(addAction: { addTrigger.host.toggle() }) }
            }
            .tabItem { Label("Hosts", systemImage: "server.rack") }
            .tag(Tab.hosts)

            NavigationStack {
                VaultView()
                    .toolbar { sharedToolbar(addAction: { addTrigger.vault.toggle() }) }
            }
            .tabItem { Label("Vault", systemImage: "lock.fill") }
            .tag(Tab.vault)

            NavigationStack {
                SnippetsView()
                    .toolbar { sharedToolbar(addAction: { addTrigger.snippet.toggle() }) }
            }
            .tabItem { Label("Snippets", systemImage: "chevron.left.forwardslash.chevron.right") }
            .tag(Tab.snippets)

            NavigationStack {
                KeysView()
                    .toolbar { sharedToolbar(addAction: { addTrigger.key.toggle() }) }
            }
            .tabItem { Label("Keys", systemImage: "key.fill") }
            .tag(Tab.keys)

            NavigationStack {
                SettingsView()
                    .toolbar { sharedToolbar(addAction: nil) }
            }
            .tabItem { Label("Settings", systemImage: "gear") }
            .tag(Tab.settings)
        }
        .background(Theme.bg.ignoresSafeArea())
        .environmentObject(addTrigger)
        .sheet(isPresented: $showNotifications) {
            NavigationStack { NotificationsView() }
        }
        .sheet(isPresented: $showCommandPalette) {
            CommandPaletteView(onConnect: { _ in })
                .environmentObject(store)
        }
        .sheet(item: $paywallFeature) { feature in
            PaywallSheet(feature: feature)
        }
        .task { notifications.startPolling() }
        .sheet(isPresented: $showMenu) {
            HamburgerMenuSheet()
                .environmentObject(paywall)
        }
    }

    @ToolbarContentBuilder
    private func sharedToolbar(addAction: (() -> Void)?) -> some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button { showMenu.toggle() } label: {
                Image(systemName: "line.3.horizontal")
                    .foregroundStyle(Theme.textStrong)
            }
        }
        ToolbarItemGroup(placement: .navigationBarTrailing) {
            if let addAction {
                Button(action: addAction) {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.textStrong)
                }
            }
            Button {
                if paywall.canAccess(.commandPalette) {
                    showCommandPalette = true
                } else {
                    paywallFeature = .commandPalette
                }
            } label: {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Theme.textStrong)
            }
            Button { showNotifications = true } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bell")
                        .foregroundStyle(Theme.textStrong)
                    if notifications.unreadCount > 0 {
                        Text(notifications.unreadCount > 9 ? "9+" : "\(notifications.unreadCount)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.black)
                            .padding(3)
                            .background(Theme.accent)
                            .clipShape(Capsule())
                            .offset(x: 8, y: -8)
                    }
                }
            }
        }
    }
}

// MARK: - HamburgerMenuSheet

struct HamburgerMenuSheet: View {
    @EnvironmentObject private var paywall: PaywallService
    @EnvironmentObject private var api: APIService
    @Environment(\.dismiss) private var dismiss
    @State private var paywallFeature: PremiumFeature?
    @State private var showDeleteAccount = false

    var body: some View {
        NavigationStack {
            List {
                Section("Quick Access") {
                    NavigationLink { HistoryView() } label: {
                        Label("Session History", systemImage: "clock.arrow.circlepath")
                    }
                }

                Section("Tools") {
                    gatedLink(label: "Session Playback", icon: "play.rectangle.on.rectangle",
                              feature: .sessionPlayback) { SessionListView() }
                    gatedLink(label: "Analytics", icon: "chart.bar.xaxis",
                              feature: .analytics) { AnalyticsDashboardView() }
                    gatedLink(label: "Audit Log", icon: "doc.text.magnifyingglass",
                              feature: .auditLog) { AuditLogView() }
                }

                Section("Organization") {
                    gatedLink(label: "Organizations", icon: "building.2",
                              feature: .organizations) { OrganizationsView() }
                }

                Section("Account") {
                    NavigationLink { SecuritySettingsView() } label: {
                        Label("Security & Passkeys", systemImage: "key.fill")
                    }
                    NavigationLink { BillingView() } label: {
                        Label("Billing & Plans", systemImage: "creditcard")
                    }
                    gatedLink(label: "P2P Sessions", icon: "person.2.wave.2",
                              feature: .p2pSessions) { P2PView() }
                }

                Section("Account") {
                    Button(role: .destructive) {
                        api.logout()
                        dismiss()
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    Button(role: .destructive) {
                        showDeleteAccount = true
                    } label: {
                        Label("Delete Account", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showDeleteAccount) {
                DeleteAccountView(api: api)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sheet(item: $paywallFeature) { feature in
            PaywallSheet(feature: feature)
        }
    }

    // Gated NavigationLink — shows lock badge on label if locked, tapping shows paywall
    @ViewBuilder
    private func gatedLink<Dest: View>(
        label: String, icon: String, feature: PremiumFeature,
        @ViewBuilder destination: @escaping () -> Dest
    ) -> some View {
        if paywall.canAccess(feature) {
            NavigationLink { destination() } label: {
                Label(label, systemImage: icon)
            }
        } else {
            Button {
                paywallFeature = feature
            } label: {
                HStack {
                    Label(label, systemImage: icon)
                    Spacer()
                    Image(systemName: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(feature.requiredPlan.color)
                }
            }
            .foregroundStyle(.primary)
        }
    }
}

// MARK: - PremiumFeature: Identifiable (for sheet(item:))
extension PremiumFeature: Identifiable { public var id: String { rawValue } }
