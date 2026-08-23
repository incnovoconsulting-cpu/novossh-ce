import Foundation
import SwiftUI
import CryptoKit

@MainActor
final class AppStore: ObservableObject {
    @Published var hosts: [Host]
    @Published var keys: [IdentityKey]
    @Published var snippets: [Snippet]
    @Published var portForwards: [PortForwarding]
    @Published var settings: UserSettings
    @Published var vaults: [Vault]
    @Published var sessionLogs: [SessionLog]

    /// Whether the app requires biometric/passcode unlock on launch.
    @Published var requiresBiometricLock: Bool {
        didSet { UserDefaults.standard.set(requiresBiometricLock, forKey: "novossh.biometricLock") }
    }

    /// Whether a PIN lock is set for the app.
    @Published var isPinSet: Bool {
        didSet { UserDefaults.standard.set(isPinSet, forKey: "novossh.isPinSet") }
    }

    /// Whether the app is currently locked (requires PIN).
    @Published var isAppLocked: Bool = false

    /// Which vaults are currently locked (vaultId -> locked).
    @Published var lockedVaults: Set<UUID> = []

    private let hostsKey = "novossh.hosts.v1"
    private let keysKey = "novossh.keys.v1"
    private let snippetsKey = "novossh.snippets.v1"
    private let portForwardsKey = "novossh.portforwards.v1"
    private let settingsKey = "novossh.settings.v1"
    private let vaultsKey = "novossh.vaults.v1"
    private let sessionLogsKey = "novossh.sessionlogs.v1"

    private let keychain = KeychainService.shared

    init() {
        let defaults = UserDefaults.standard
        self.hosts = Self.decode([Host].self, defaults.data(forKey: hostsKey))
            ?? AppStore.seedHosts
        self.keys = Self.decode([IdentityKey].self, defaults.data(forKey: keysKey)) ?? []
        self.snippets = Self.decode([Snippet].self, defaults.data(forKey: snippetsKey))
            ?? AppStore.seedSnippets
        self.portForwards = Self.decode([PortForwarding].self, defaults.data(forKey: portForwardsKey)) ?? []
        self.settings = Self.decode(UserSettings.self, defaults.data(forKey: settingsKey))
            ?? UserSettings()
        self.vaults = Self.decode([Vault].self, defaults.data(forKey: vaultsKey)) ?? []
        self.sessionLogs = Self.decode([SessionLog].self, defaults.data(forKey: sessionLogsKey)) ?? []
        let biometricLock = defaults.bool(forKey: "novossh.biometricLock")
        self.requiresBiometricLock = biometricLock
        self.isPinSet = defaults.bool(forKey: "novossh.isPinSet")
        self.isAppLocked = defaults.bool(forKey: "novossh.isPinSet")

        Self.removeLegacyDemoHosts(from: &hosts, defaults: defaults)
    }

    /// One-time cleanup for accounts created before demo-host seeding was removed: strips
    /// the placeholder hosts (matched by their fixed demo addresses, not by label, so a
    /// real host a user happens to name "home-pi" is never touched) and persists the
    /// result. No-ops after the first run via a UserDefaults flag.
    private static func removeLegacyDemoHosts(from hosts: inout [Host], defaults: UserDefaults) {
        let flagKey = "novossh.removedLegacyDemoHosts.v1"
        guard !defaults.bool(forKey: flagKey) else { return }
        defaults.set(true, forKey: flagKey)

        let demoAddresses: Set<String> = ["web01.example.com", "10.0.4.21", "raspberrypi.local"]
        let before = hosts.count
        hosts.removeAll { demoAddresses.contains($0.address) }
        if hosts.count != before, let data = Self.encode(hosts) {
            defaults.set(data, forKey: "novossh.hosts.v1")
        }
    }

    // MARK: persistence
    private static func decode<T: Decodable>(_ type: T.Type, _ data: Data?) -> T? {
        guard let data else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
    private static func encode<T: Encodable>(_ value: T) -> Data? {
        try? JSONEncoder().encode(value)
    }

    private func persist() {
        let d = UserDefaults.standard
        if let h = Self.encode(hosts) { d.set(h, forKey: hostsKey) }
        if let k = Self.encode(keys) { d.set(k, forKey: keysKey) }
        if let s = Self.encode(snippets) { d.set(s, forKey: snippetsKey) }
        if let pf = Self.encode(portForwards) { d.set(pf, forKey: portForwardsKey) }
        if let st = Self.encode(settings) { d.set(st, forKey: settingsKey) }
        if let v = Self.encode(vaults) { d.set(v, forKey: vaultsKey) }
        if let sl = Self.encode(sessionLogs) { d.set(sl, forKey: sessionLogsKey) }
    }

    /// Wipes all account-scoped data from memory and disk. Called on logout so a
    /// different account signing in on the same device never inherits the previous
    /// user's hosts, keys, snippets or vaults. Device-level preferences (theme, PIN,
    /// biometric lock) are intentionally preserved. Empty arrays are persisted (rather
    /// than removing the keys) so the first-launch seed data does not reappear.
    func clearLocalData() {
        hosts = []
        keys = []
        snippets = []
        portForwards = []
        vaults = []
        sessionLogs = []
        lockedVaults = []
        persist()
    }

    // MARK: hosts
    func addHost(_ h: Host, password: String? = nil) {
        if let pw = password { keychain.setPassword(pw, for: h.id) }
        hosts.insert(h, at: 0); persist()
    }
    func updateHost(_ h: Host, password: String? = nil) {
        if let pw = password { keychain.setPassword(pw, for: h.id) }
        if let i = hosts.firstIndex(where: { $0.id == h.id }) {
            var updated = h; updated.updatedAt = Date()
            hosts[i] = updated; persist()
        }
    }
    func deleteHost(_ id: UUID) {
        keychain.deletePassword(for: id)
        hosts.removeAll { $0.id == id }; persist()
    }
    func touchHost(_ id: UUID) {
        if let i = hosts.firstIndex(where: { $0.id == id }) {
            hosts[i].lastConnectedAt = Date(); persist()
        }
    }

    /// Retrieve the stored password for a host from Keychain.
    /// Falls back to the in-memory `host.password` field for backwards compatibility.
    func resolvedPassword(for host: Host) -> String? {
        keychain.getPassword(for: host.id) ?? host.password
    }

    // MARK: keys
    func addKey(_ k: IdentityKey, privateKeyPEM: String? = nil) {
        if let pem = privateKeyPEM { keychain.setPrivateKey(pem, for: k.id) }
        keys.insert(k, at: 0); persist()
    }
    func deleteKey(_ id: UUID) {
        keychain.deletePrivateKey(for: id)
        keys.removeAll { $0.id == id }; persist()
    }
    func key(by id: UUID?) -> IdentityKey? { keys.first { $0.id == id } }

    /// Retrieve the PEM private key from Keychain.
    func resolvedPrivateKey(for key: IdentityKey) -> String? {
        keychain.getPrivateKey(for: key.id) ?? (key.privateKey.isEmpty ? nil : key.privateKey)
    }

    // MARK: port forwarding
    func addPortForward(_ pf: PortForwarding) { portForwards.insert(pf, at: 0); persist() }
    func updatePortForward(_ pf: PortForwarding) {
        if let i = portForwards.firstIndex(where: { $0.id == pf.id }) {
            portForwards[i] = pf; persist()
        }
    }
    func deletePortForward(_ pf: PortForwarding) {
        portForwards.removeAll { $0.id == pf.id }; persist()
    }

    // MARK: snippets
    func addSnippet(_ s: Snippet) { snippets.insert(s, at: 0); persist() }
    func deleteSnippet(_ id: UUID) { snippets.removeAll { $0.id == id }; persist() }

    // MARK: cloud sync merge
    /// Merges a server-pulled payload into local state: updates existing items
    /// whose remote copy is newer, inserts items that don't exist locally yet.
    func mergeFromRemote(
        hosts remoteHosts: [APIService.RemoteHost],
        keys remoteKeys: [APIService.RemoteKey],
        snippets remoteSnippets: [APIService.RemoteSnippet]
    ) {
        let iso = ISO8601DateFormatter()

        for rh in remoteHosts {
            guard let id = UUID(uuidString: rh.id) else { continue }
            let remoteUpdatedAt = rh.updatedAt.isEmpty ? Date() : (iso.date(from: rh.updatedAt) ?? Date())
            var host = Host(
                id: id, label: rh.label, address: rh.address, port: rh.port,
                username: rh.username, authMethod: AuthMethod(rawValue: rh.authMethod) ?? .password,
                tags: rh.tags, colorHex: rh.colorHex, notes: rh.notes,
                lastConnectedAt: rh.lastConnectedAt.flatMap { iso.date(from: $0) },
                updatedAt: remoteUpdatedAt
            )
            if let i = hosts.firstIndex(where: { $0.id == id }) {
                if remoteUpdatedAt > hosts[i].updatedAt {
                    host.createdAt = hosts[i].createdAt
                    hosts[i] = host
                }
            } else if let i = hosts.firstIndex(where: {
                $0.address == rh.address && $0.username == rh.username && $0.port == rh.port
            }) {
                // Same host exists under a different UUID — adopt the server's UUID and update if newer
                hosts[i].id = id
                if remoteUpdatedAt > hosts[i].updatedAt {
                    host.createdAt = hosts[i].createdAt
                    hosts[i] = host
                }
            } else {
                hosts.append(host)
            }
        }

        for rk in remoteKeys {
            guard let id = UUID(uuidString: rk.id) else { continue }
            guard !keys.contains(where: { $0.id == id }) else { continue }
            let createdAt = rk.createdAt.isEmpty ? Date() : (iso.date(from: rk.createdAt) ?? Date())
            keys.append(IdentityKey(
                id: id, label: rk.label, privateKey: "",
                publicKey: rk.publicKey, hasPassphrase: rk.hasPassphrase, createdAt: createdAt
            ))
        }

        for rs in remoteSnippets {
            guard let id = UUID(uuidString: rs.id) else { continue }
            if let i = snippets.firstIndex(where: { $0.id == id }) {
                _ = i // already exists by UUID, skip
            } else if let i = snippets.firstIndex(where: { $0.command == rs.command }) {
                snippets[i].id = id
            } else {
                let createdAt = rs.createdAt.isEmpty ? Date() : (iso.date(from: rs.createdAt) ?? Date())
                snippets.append(Snippet(
                    id: id, label: rs.label, command: rs.command,
                    description: rs.description, tags: rs.tags, createdAt: createdAt
                ))
            }
        }

        persist()
    }

    // MARK: settings
    func updateSettings(_ s: UserSettings) { settings = s; persist() }

    // MARK: vaults
    func addVault(_ v: Vault) { vaults.insert(v, at: 0); persist() }
    func deleteVault(_ id: UUID) { vaults.removeAll { $0.id == id }; persist() }
    func updateVault(_ v: Vault) {
        if let i = vaults.firstIndex(where: { $0.id == v.id }) {
            var updated = v; updated.updatedAt = Date()
            vaults[i] = updated; persist()
        }
    }
    func entries(for vaultId: UUID) -> [VaultEntry] {
        UserDefaults.standard.data(forKey: "novossh.vault_entries_\(vaultId.uuidString)")
            .flatMap { try? JSONDecoder().decode([VaultEntry].self, from: $0) } ?? []
    }
    func addEntry(_ e: VaultEntry, to vaultId: UUID) {
        var list = entries(for: vaultId)
        list.append(e)
        if let data = try? JSONEncoder().encode(list) {
            UserDefaults.standard.set(data, forKey: "novossh.vault_entries_\(vaultId.uuidString)")
        }
        updateVault(Vault(id: vaultId, name: vaults.first(where: { $0.id == vaultId })?.name ?? "", updatedAt: Date()))
    }
    func deleteEntry(_ entryId: UUID, from vaultId: UUID) {
        var list = entries(for: vaultId)
        list.removeAll { $0.id == entryId }
        if let data = try? JSONEncoder().encode(list) {
            UserDefaults.standard.set(data, forKey: "novossh.vault_entries_\(vaultId.uuidString)")
        }
    }

    func updateEntry(_ entry: VaultEntry, in vaultId: UUID) {
        var list = entries(for: vaultId)
        if let i = list.firstIndex(where: { $0.id == entry.id }) {
            var updated = entry
            updated.updatedAt = Date()
            list[i] = updated
            if let data = try? JSONEncoder().encode(list) {
                UserDefaults.standard.set(data, forKey: "novossh.vault_entries_\(vaultId.uuidString)")
            }
        }
    }

    func syncVaultEntries(from server: [VaultEntry], for vaultId: UUID) {
        UserDefaults.standard.set(
            try? JSONEncoder().encode(server),
            forKey: "novossh.vault_entries_\(vaultId.uuidString)"
        )
    }

    // MARK: session logs
    func addSessionLog(_ log: SessionLog) { sessionLogs.insert(log, at: 0); persist() }
    func bookmarkLog(_ id: UUID, comment: String? = nil) {
        if let i = sessionLogs.firstIndex(where: { $0.id == id }) {
            sessionLogs[i].bookmarked = true
            sessionLogs[i].bookmarkComment = comment
            persist()
        }
    }
    func unbookmarkLog(_ id: UUID) {
        if let i = sessionLogs.firstIndex(where: { $0.id == id }) {
            sessionLogs[i].bookmarked = false
            sessionLogs[i].bookmarkComment = nil
            persist()
        }
    }

    // MARK: PIN lock
    func savePin(_ pin: String) {
        let data = pin.data(using: .utf8)!
        let hashed = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hashed, forKey: "novossh.pinHash")
        UserDefaults.standard.set(pin.count, forKey: "novossh.pinLength")
    }

    var savedPinLength: Int {
        let len = UserDefaults.standard.integer(forKey: "novossh.pinLength")
        return len > 0 ? len : 6
    }

    func validatePin(_ pin: String) -> Bool {
        guard let storedHash = UserDefaults.standard.string(forKey: "novossh.pinHash") else { return false }
        let data = pin.data(using: .utf8)!
        let hashed = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return hashed == storedHash
    }

    func unlockApp() { isAppLocked = false }
    func lockApp() { isAppLocked = isPinSet }
    func unlockVault(_ id: UUID) { lockedVaults.remove(id) }
    func lockVault(_ id: UUID) { lockedVaults.insert(id) }
    func isVaultLocked(_ id: UUID) -> Bool { lockedVaults.contains(id) }

    // MARK: seed
    // No demo/sample hosts — new users start with an empty host list. (Placeholder
    // demo hosts previously seeded here confused new users and synced up to the server.)
    private static let seedHosts: [Host] = []

    private static let seedSnippets: [Snippet] = [
        Snippet(label: "Disk usage", command: "df -hT | sort -k6,6",
                description: "Show mounted filesystems sorted by mountpoint.",
                tags: ["system"]),
        Snippet(label: "Top processes by memory",
                command: "ps aux --sort=-rss | head -n 15",
                description: "Top 15 processes ranked by resident memory.",
                tags: ["system", "perf"]),
        Snippet(label: "Tail nginx errors",
                command: "sudo tail -f /var/log/nginx/error.log",
                tags: ["nginx", "logs"]),
        Snippet(label: "List listening ports", command: "ss -tulpn",
                tags: ["network"]),
    ]
}

// String helpers used throughout the UI
extension String {
    var initialsForAvatar: String {
        let parts = self
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: ".", with: " ")
            .split(separator: " ")
        return parts.prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

extension Date {
    var relativeShort: String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: self, relativeTo: Date())
    }
}
