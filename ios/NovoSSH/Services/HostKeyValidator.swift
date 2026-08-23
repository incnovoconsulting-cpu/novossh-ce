import Foundation
import Citadel
import CryptoKit

/// Handles SSH host-key trust-on-first-use (TOFU) with known-hosts database.
/// Stores fingerprints of trusted hosts and verifies on reconnection.
final class HostKeyValidator: @unchecked Sendable {
    static let shared = HostKeyValidator()

    private let keychain = KeychainService.shared
    private let knownHostsKey = "novossh.known-hosts.v1"

    private init() {}

    struct HostKey: Codable {
        let host: String
        let port: Int
        let algorithm: String
        let fingerprint: String  // SHA256 hex
        let firstSeen: Date
        var lastSeen: Date
    }

    // MARK: - Storage

    private func loadKnownHosts() -> [HostKey] {
        guard let data = keychain.get(forKey: knownHostsKey) else { return [] }
        let decoder = JSONDecoder()
        return (try? decoder.decode([HostKey].self, from: data.data(using: .utf8) ?? Data())) ?? []
    }

    private func saveKnownHosts(_ hosts: [HostKey]) {
        guard let data = try? JSONEncoder().encode(hosts),
              let json = String(data: data, encoding: .utf8) else { return }
        keychain.set(json, forKey: knownHostsKey)
    }

    // MARK: - Validation

    /// Validate host key with TOFU (trust-on-first-use).
    /// - On first connection to a host: store the fingerprint
    /// - On reconnection: verify fingerprint matches
    /// - Returns: true if key is trusted, false if mismatch (reject connection)
    func validateHostKey(_ publicKey: Data, hostAddress: String, port: Int) -> Bool {
        let algorithm = "ssh-rsa"  // Would be determined from key type in production
        let fingerprint = computeFingerprint(publicKey)

        var knownHosts = loadKnownHosts()
        let key = HostKey(
            host: hostAddress,
            port: port,
            algorithm: algorithm,
            fingerprint: fingerprint,
            firstSeen: Date(),
            lastSeen: Date()
        )

        // Check if host already known
        if let existingIndex = knownHosts.firstIndex(where: { h in
            h.host == hostAddress && h.port == port
        }) {
            let existing = knownHosts[existingIndex]
            if existing.fingerprint == fingerprint {
                // Fingerprint matches, update last seen
                knownHosts[existingIndex].lastSeen = Date()
                saveKnownHosts(knownHosts)
                return true
            } else {
                // Fingerprint mismatch - possible MITM
                return false
            }
        }

        // First time seeing this host - trust and store
        knownHosts.append(key)
        saveKnownHosts(knownHosts)
        return true
    }

    // MARK: - Fingerprinting

    /// Compute SHA256 fingerprint of public key (OpenSSH format).
    private func computeFingerprint(_ publicKey: Data) -> String {
        let digest = SHA256.hash(data: publicKey)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Known Hosts Management

    func getKnownHosts() -> [HostKey] {
        loadKnownHosts()
    }

    func removeKnownHost(host: String, port: Int) {
        var hosts = loadKnownHosts()
        hosts.removeAll { h in h.host == host && h.port == port }
        saveKnownHosts(hosts)
    }

    func clearAllKnownHosts() {
        keychain.delete(forKey: knownHostsKey)
    }
}
