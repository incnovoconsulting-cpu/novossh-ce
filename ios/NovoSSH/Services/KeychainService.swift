import Foundation
import Security

/// Thin wrapper around iOS Keychain for storing sensitive strings (passwords, private keys).
/// All items are scoped to the app bundle identifier under `kSecAttrService`.
final class KeychainService: @unchecked Sendable {
    static let shared = KeychainService()
    private let service = Bundle.main.bundleIdentifier ?? "app.novossh.ios"

    private init() {}

    // MARK: - Write

    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        // Remove any existing item first
        SecItemDelete(query as CFDictionary)

        var attrs = query
        attrs[kSecValueData] = data
        attrs[kSecAttrAccessible] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        return SecItemAdd(attrs as CFDictionary, nil) == errSecSuccess
    }

    // MARK: - Read

    func get(forKey key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else { return nil }
        return string
    }

    // MARK: - Delete

    @discardableResult
    func delete(forKey key: String) -> Bool {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess
    }

    // MARK: - Convenience helpers for host credentials

    func passwordKey(for hostId: UUID) -> String { "host.pw.\(hostId.uuidString)" }
    func privateKeyKey(for keyId: UUID) -> String { "identity.pk.\(keyId.uuidString)" }

    func setPassword(_ password: String, for hostId: UUID) {
        set(password, forKey: passwordKey(for: hostId))
    }
    func getPassword(for hostId: UUID) -> String? {
        get(forKey: passwordKey(for: hostId))
    }
    func deletePassword(for hostId: UUID) {
        delete(forKey: passwordKey(for: hostId))
    }

    func setPrivateKey(_ pem: String, for keyId: UUID) {
        set(pem, forKey: privateKeyKey(for: keyId))
    }
    func getPrivateKey(for keyId: UUID) -> String? {
        get(forKey: privateKeyKey(for: keyId))
    }
    func deletePrivateKey(for keyId: UUID) {
        delete(forKey: privateKeyKey(for: keyId))
    }

    // MARK: - Auth token storage

    func setAuthToken(_ token: String) { set(token, forKey: "novossh.auth.token") }
    func getAuthToken() -> String? { get(forKey: "novossh.auth.token") }
    func deleteAuthToken() { delete(forKey: "novossh.auth.token") }

    func setRefreshToken(_ token: String) { set(token, forKey: "novossh.auth.refreshToken") }
    func getRefreshToken() -> String? { get(forKey: "novossh.auth.refreshToken") }
    func deleteRefreshToken() { delete(forKey: "novossh.auth.refreshToken") }
}
