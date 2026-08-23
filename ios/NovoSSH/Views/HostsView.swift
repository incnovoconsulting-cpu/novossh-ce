import SwiftUI

struct HostsView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var paywall: PaywallService
    @EnvironmentObject private var addTrigger: AddItemTrigger
    @State private var query = ""
    @State private var editingHost: Host?
    @State private var newHost = false
    @State private var showPaywall = false

    // Two-step connect:
    //   1) tap host → if it needs a password, set `pendingPasswordFor`
    //   2) on submit (or for non-password auth), set `connectingHost` to push terminal
    @State private var pendingPasswordFor: Host?
    @State private var pendingPassword = ""
    @State private var connectingHost: Host?
    @State private var portForwardingHost: Host?
    @State private var portForwardingPaywallFeature: PremiumFeature?
    @State private var sftpHost: Host?
    @State private var sftpPaywallFeature: PremiumFeature?

    var filtered: [Host] {
        guard !query.isEmpty else { return store.hosts }
        return store.hosts.filter {
            $0.label.localizedCaseInsensitiveContains(query)
            || $0.address.localizedCaseInsensitiveContains(query)
            || $0.username.localizedCaseInsensitiveContains(query)
            || $0.tags.contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    var recent: [Host] {
        store.hosts
            .filter { $0.lastConnectedAt != nil }
            .sorted { ($0.lastConnectedAt ?? .distantPast) > ($1.lastConnectedAt ?? .distantPast) }
            .prefix(5)
            .map { $0 }
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            List {
                if !recent.isEmpty && query.isEmpty {
                    Section("Recent") {
                        ForEach(recent) { h in
                            HostRow(host: h, action: { initiateConnect(h) })
                                .listRowBackground(Theme.panel)
                        }
                    }
                }
                if let max = paywall.currentPlan.maxHosts {
                    Section {
                        LimitBanner(
                            message: "\(store.hosts.count)/\(max) hosts used on \(paywall.currentPlan.displayName) plan",
                            plan: .starter
                        )
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init())
                    }
                }
                Section("All hosts (\(filtered.count))") {
                    ForEach(filtered) { h in
                        HostRow(host: h, action: { initiateConnect(h) })
                            .listRowBackground(Theme.panel)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    store.deleteHost(h.id)
                                } label: { Label("Delete", systemImage: "trash") }
                                Button { editingHost = h } label: {
                                    Label("Edit", systemImage: "pencil")
                                }.tint(Theme.accent)
                            }
                            .contextMenu {
                                // Right-click is the only discoverable edit/delete path on Mac
                                // Catalyst — swipeActions (trackpad-only, undiscoverable there)
                                // was previously the sole way to reach these.
                                Button { editingHost = h } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                Button {
                                    if paywall.canAccess(.sftpBrowser) {
                                        sftpHost = h
                                    } else {
                                        sftpPaywallFeature = .sftpBrowser
                                    }
                                } label: {
                                    Label("SFTP Browser", systemImage: "folder")
                                }
                                Button {
                                    if paywall.canAccess(.portForwarding) {
                                        portForwardingHost = h
                                    } else {
                                        portForwardingPaywallFeature = .portForwarding
                                    }
                                } label: {
                                    Label("Port Forwarding", systemImage: "arrow.left.arrow.right")
                                }
                                Divider()
                                Button(role: .destructive) {
                                    store.deleteHost(h.id)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .listStyle(.insetGrouped)
        }
        .navigationTitle("Hosts")
        .navigationDestination(item: $portForwardingHost) { host in
            PortForwardingView(host: host)
        }
        .sheet(item: $portForwardingPaywallFeature) { feature in
            PaywallSheet(feature: feature)
        }
        .navigationDestination(item: $sftpHost) { host in
            SFTPBrowserView(host: host)
        }
        .sheet(item: $sftpPaywallFeature) { feature in
            PaywallSheet(feature: feature)
        }
        .navigationDestination(item: $connectingHost) { host in
            TerminalSessionView(host: host)
        }
        #if os(iOS)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
        #else
        .searchable(text: $query)
        #endif
        .onChange(of: addTrigger.host) { _, _ in
            if paywall.canAddHost(currentCount: store.hosts.count) {
                newHost = true
            } else {
                showPaywall = true
            }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallSheet(feature: .unlimitedHosts)
        }
        .sheet(isPresented: $newHost) {
            HostFormView(host: nil) { h in
                store.addHost(h); newHost = false
            } onCancel: { newHost = false }
        }
        .sheet(item: $editingHost) { h in
            HostFormView(host: h) { updated in
                store.updateHost(updated); editingHost = nil
            } onCancel: { editingHost = nil }
        }
        .alert("Enter password",
               isPresented: Binding(
                get: { pendingPasswordFor != nil },
                set: { if !$0 { pendingPasswordFor = nil; pendingPassword = "" } }),
               presenting: pendingPasswordFor) { host in
            SecureField("Password", text: $pendingPassword)
            Button("Cancel", role: .cancel) {
                pendingPasswordFor = nil; pendingPassword = ""
            }
            Button("Connect") {
                if var h = store.hosts.first(where: { $0.id == host.id }) {
                    h.password = pendingPassword
                    store.updateHost(h)
                    pendingPasswordFor = nil
                    pendingPassword = ""
                    connectingHost = h
                }
            }
        } message: { host in
            Text("\(host.username)@\(host.address)")
        }
    }

    private func initiateConnect(_ h: Host) {
        if h.authMethod == .password && (h.password ?? "").isEmpty {
            pendingPasswordFor = h
        } else {
            connectingHost = h
        }
    }
}

struct HostRow: View {
    let host: Host
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    let bg = host.colorHex.flatMap { Color(hex: $0) }
                        ?? Theme.avatarColor(for: host.label)
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(bg)
                        .frame(width: 38, height: 38)
                    Text(host.label.initialsForAvatar)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(host.label).foregroundStyle(.white)
                    Text("\(host.username)@\(host.address):\(host.port)")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.55))
                        .lineLimit(1)
                }
                Spacer()
                if let when = host.lastConnectedAt {
                    Text(when.relativeShort)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.4))
                }
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.3))
            }
        }
        .buttonStyle(.plain)
    }
}
