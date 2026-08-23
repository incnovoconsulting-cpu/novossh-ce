import Foundation
import NIO
import NIOSSH
import Crypto
import Citadel

/// Custom NIOSSHClientUserAuthenticationDelegate that performs SSH certificate authentication.
/// Uses Citadel's `.custom()` escape hatch since Citadel doesn't expose a native cert auth factory.
final class CertificateAuthDelegate: NIOSSHClientUserAuthenticationDelegate {
    private let username: String
    private let privateKey: NIOSSHPrivateKey
    private let certifiedKey: NIOSSHCertifiedPublicKey

    init(username: String, privateKey: NIOSSHPrivateKey, certifiedKey: NIOSSHCertifiedPublicKey) {
        self.username = username
        self.privateKey = privateKey
        self.certifiedKey = certifiedKey
    }

    func nextAuthenticationType(
        availableMethods: NIOSSHAvailableUserAuthenticationMethods,
        nextChallengePromise: EventLoopPromise<NIOSSHUserAuthenticationOffer?>
    ) {
        guard availableMethods.contains(.publicKey) else {
            nextChallengePromise.fail(SSHError.unsupported("Server does not accept public key authentication"))
            return
        }

        let offer = NIOSSHUserAuthenticationOffer(
            username: username,
            serviceName: "",
            offer: .privateKey(
                .init(privateKey: privateKey, certifiedKey: certifiedKey)
            )
        )
        nextChallengePromise.succeed(offer)
    }
}

// MARK: - Certificate Parsing Helpers

extension CertificateAuthDelegate {
    /// Parse an OpenSSH certificate blob (single-line format) into NIOSSHCertifiedPublicKey.
    /// The blob should be in the format: ssh-ed25519-cert-v01@openssh.com AAAA...base64... comment
    static func parseCertificate(_ certString: String) throws -> NIOSSHCertifiedPublicKey {
        let trimmed = certString.trimmingCharacters(in: .whitespacesAndNewlines)

        // Parse the OpenSSH public key format: algorithm base64data [comment]
        let parts = trimmed.split(separator: " ", maxSplits: 2)
        guard parts.count >= 2 else {
            throw SSHError.unsupported("Invalid certificate format")
        }

        // Reconstruct the standard OpenSSH public key string (algorithm + base64)
        let opensshKey = "\(parts[0]) \(parts[1])"

        let publicKey = try NIOSSHPublicKey(openSSHPublicKey: opensshKey)

        guard let certifiedKey = NIOSSHCertifiedPublicKey(publicKey) else {
            throw SSHError.unsupported("Certificate is not a valid OpenSSH certificate")
        }

        return certifiedKey
    }

    /// Create a CertificateAuthDelegate from a certificate string and private key PEM.
    ///
    /// The private key is parsed the same way normal key auth does (SSHKeyDetection +
    /// Citadel's OpenSSH ed25519 parser) and wrapped as a NIOSSHPrivateKey. Only ed25519
    /// keys are supported for certificate auth today; other types (and passphrase-protected
    /// keys, which SSHSession rejects before calling this) throw a clear error. This mirrors
    /// the ed25519 path in SSHSession.connectDirect(case .key) — the pinned swift-nio-ssh
    /// fork has no PEM initializer, so we go through swift-crypto's Curve25519 type.
    static func create(
        username: String,
        certificate: String,
        privateKeyPEM: String
    ) throws -> CertificateAuthDelegate {
        let certifiedKey = try parseCertificate(certificate)

        let keyType = try SSHKeyDetection.detectPrivateKeyType(from: privateKeyPEM)
        let privateKey: NIOSSHPrivateKey
        switch keyType {
        case .ed25519:
            let priv = try Curve25519.Signing.PrivateKey(sshEd25519: privateKeyPEM)
            privateKey = NIOSSHPrivateKey(ed25519Key: priv)
        default:
            throw SSHError.unsupported("\(keyType) private keys for certificate auth")
        }

        return CertificateAuthDelegate(
            username: username,
            privateKey: privateKey,
            certifiedKey: certifiedKey
        )
    }
}
