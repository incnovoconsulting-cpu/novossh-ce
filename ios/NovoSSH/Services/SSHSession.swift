import Foundation
import Citadel
import NIO
import NIOSSH
import Crypto

/// Manages an SSH session, automatically routing through the backend relay
/// when the target host is on a private network (Headscale mesh handles the rest).
@MainActor
final class SSHSession: ObservableObject {
    enum Status: Equatable {
        case idle, connecting, connected, disconnected, failed(String)
    }

    @Published var status: Status = .idle
    @Published var lastError: String?

    var onData: ((Data) -> Void)?

    private var client: SSHClient?
    private var stdinWriter: TTYStdinWriter?
    private var relayTransport: WebSocketSSHTransport?

    // MARK: - Connect

    func connect(
        host: Host,
        identityKey: IdentityKey?,
        connectionMode: SSHConnectionMode = .direct
    ) async {
        status = .connecting
        lastError = nil

        let mode = DirectSSHConnectionManager.determineConnectionMode(
            hostAddress: host.address,
            requestedMode: connectionMode
        )

        do {
            if mode == .relay {
                try await connectViaRelay(host: host, identityKey: identityKey)
            } else {
                try await connectDirect(host: host, identityKey: identityKey, mode: mode)
            }
        } catch {
            lastError = error.localizedDescription
            status = .failed(error.localizedDescription)
        }
    }

    // MARK: - Direct (Citadel)

    private func connectDirect(host: Host, identityKey: IdentityKey?, mode: SSHConnectionMode) async throws {
        let auth: SSHAuthenticationMethod
        switch host.authMethod {
        case .password:
            guard let pw = host.password, !pw.isEmpty else {
                throw SSHError.missingCredential("password")
            }
            auth = .passwordBased(username: host.username, password: pw)
        case .key:
            guard let key = identityKey else { throw SSHError.missingCredential("private key") }
            if key.hasPassphrase {
                throw SSHError.unsupported("passphrase-protected private keys")
            }
            let keyType = try SSHKeyDetection.detectPrivateKeyType(from: key.privateKey)
            switch keyType {
            case .ed25519:
                let priv = try Curve25519.Signing.PrivateKey(sshEd25519: key.privateKey)
                auth = .ed25519(username: host.username, privateKey: priv)
            case .rsa:
                let priv = try Insecure.RSA.PrivateKey(sshRsa: key.privateKey)
                auth = .rsa(username: host.username, privateKey: priv)
            default:
                throw SSHError.unsupported("\(keyType) keys")
            }
        case .agent:
            throw SSHError.unsupported("SSH agent forwarding")
        case .cert:
            guard let key = identityKey else { throw SSHError.missingCredential("private key") }
            guard let cert = host.certificate, !cert.isEmpty else {
                throw SSHError.missingCredential("certificate")
            }
            if key.hasPassphrase {
                throw SSHError.unsupported("passphrase-protected private keys for cert auth")
            }
            let certDelegate = try CertificateAuthDelegate.create(
                username: host.username,
                certificate: cert,
                privateKeyPEM: key.privateKey
            )
            auth = .custom(certDelegate)
        }

        let (connectHost, connectPort) = DirectSSHConnectionManager.resolveTarget(
            hostAddress: host.address,
            hostPort: UInt16(host.port),
            connectionMode: mode
        )

        let settings = SSHClientSettings(
            host: connectHost,
            port: Int(connectPort),
            authenticationMethod: { auth },
            hostKeyValidator: SSHHostKeyValidator.acceptAnything()
        )
        let client = try await SSHClient.connect(to: settings)
        self.client = client
        // openInteractiveShell only returns once the session actually ends — Citadel's
        // withPTY closes the channel as soon as its closure returns, so the closure must
        // keep running (reading stdout/stderr) for the whole session lifetime. status is
        // set to .connected from inside that closure instead, not here.
        try await openInteractiveShell(client: client)
    }

    // MARK: - Relay (WebSocket → backend → Headscale mesh)

    private func connectViaRelay(host: Host, identityKey: IdentityKey?) async throws {
        // Proactively refresh if the token is expired/near-expiry — the relay
        // authenticates once at WebSocket handshake time with no retry, so a stale
        // token here fails the whole connection rather than a single request.
        guard let token = await APIService.shared.validAccessToken(), !token.isEmpty else {
            throw SSHError.missingCredential("auth token")
        }
        let baseURL = APIService.shared.baseURL
        guard !baseURL.isEmpty else { throw SSHError.missingCredential("server URL") }

        var password: String?
        var privateKey: String?
        var passphrase: String?
        var certificate: String?

        switch host.authMethod {
        case .password:
            guard let pw = host.password, !pw.isEmpty else {
                throw SSHError.missingCredential("password")
            }
            password = pw
        case .cert:
            guard let cert = host.certificate, !cert.isEmpty else {
                throw SSHError.missingCredential("certificate")
            }
            guard let key = identityKey else {
                throw SSHError.missingCredential("private key")
            }
            certificate = cert
            privateKey = key.privateKey
        case .key, .agent:
            throw SSHError.unsupported("Key/agent auth via relay")
        }

        let transport = WebSocketSSHTransport()
        self.relayTransport = transport

        transport.onData = { [weak self] data in
            self?.onData?(data)
        }

        // Wait for connected or failed
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var resumed = false
            transport.onStateChange = { [weak self] state in
                guard let self else { return }
                switch state {
                case .connected:
                    self.status = .connected
                    if !resumed { resumed = true; continuation.resume() }
                case .failed(let msg):
                    self.status = .failed(msg)
                    if !resumed { resumed = true; continuation.resume(throwing: SSHError.relayError(msg)) }
                case .disconnected:
                    if self.status == .connected { self.status = .disconnected }
                    if !resumed { resumed = true; continuation.resume(throwing: SSHError.relayError("Disconnected")) }
                default:
                    break
                }
            }

            transport.connect(
                relayURL: baseURL,
                authToken: token,
                host: host.address,
                port: host.port,
                username: host.username,
                password: password,
                privateKey: privateKey,
                passphrase: passphrase,
                certificate: certificate
            )
        }
    }

    // MARK: - PTY shell (direct only)

    private func openInteractiveShell(client: SSHClient) async throws {
        let request = SSHChannelRequestEvent.PseudoTerminalRequest(
            wantReply: true,
            term: "xterm-256color",
            terminalCharacterWidth: 80,
            terminalRowHeight: 24,
            terminalPixelWidth: 0,
            terminalPixelHeight: 0,
            terminalModes: SSHTerminalModes([:])
        )

        try await client.withPTY(request) { [weak self] inbound, outbound in
            self?.stdinWriter = outbound
            await MainActor.run { self?.status = .connected }
            await withCheckedContinuation { continuation in
                Task {
                    do {
                        for try await chunk in inbound {
                            switch chunk {
                            case .stdout(let buffer):
                                let data = Data(buffer: buffer)
                                await MainActor.run { self?.onData?(data) }
                            case .stderr(let buffer):
                                let data = Data(buffer: buffer)
                                await MainActor.run { self?.onData?(data) }
                            }
                        }
                        await MainActor.run {
                            if self?.status == .connected { self?.status = .disconnected }
                        }
                    } catch {
                        await MainActor.run { self?.status = .failed(error.localizedDescription) }
                    }
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - I/O

    func send(_ data: Data) async {
        if let relay = relayTransport {
            relay.sendData(data)
        } else if let writer = stdinWriter {
            try? await writer.write(.init(bytes: data))
        }
    }

    func resize(cols: UInt16, rows: UInt16) async throws {
        if let relay = relayTransport {
            relay.sendResize(cols: Int(cols), rows: Int(rows))
        } else if let writer = stdinWriter {
            try await writer.changeSize(cols: Int(cols), rows: Int(rows), pixelWidth: 0, pixelHeight: 0)
        }
    }

    func disconnect() async {
        relayTransport?.disconnect()
        relayTransport = nil
        stdinWriter = nil
        try? await client?.close()
        client = nil
        status = .disconnected
    }

    // MARK: - SFTP (direct connections only)

    func setupPortForward(_ forward: PortForwarding) async throws {
        throw SSHError.unsupported("Port forwarding")
    }

    func cancelPortForward(_ forward: PortForwarding) async throws {
        throw SSHError.unsupported("Port forwarding")
    }

    func listFiles(path: String = "/") async throws -> [SFTPFile] {
        guard let client else { throw SSHError.unsupported("SFTP requires a direct connection") }
        let sftp = try await client.openSFTP()
        let names = try await sftp.listDirectory(atPath: path)
        var files: [SFTPFile] = []
        for name in names {
            for component in name.components {
                let attrs = component.attributes
                let isDir = (attrs.permissions ?? 0) & 0o170000 == 0o040000
                files.append(SFTPFile(
                    name: component.filename,
                    path: (path as NSString).appendingPathComponent(component.filename),
                    isDirectory: isDir,
                    size: Int64(attrs.size ?? 0),
                    modified: attrs.accessModificationTime?.modificationTime ?? Date(),
                    permissions: String(attrs.permissions ?? 0, radix: 8),
                    owner: attrs.uidgid.map { String($0.userId) },
                    group: attrs.uidgid.map { String($0.groupId) }
                ))
            }
        }
        return files.sorted { a, b in
            a.isDirectory != b.isDirectory ? a.isDirectory : a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    func downloadFile(remotePath: String, localURL: URL) async throws {
        guard let client else { throw SSHError.unsupported("SFTP requires a direct connection") }
        let sftp = try await client.openSFTP()
        try await sftp.withFile(filePath: remotePath, flags: .read) { file in
            let buffer = try await file.readAll()
            try Data(buffer: buffer).write(to: localURL)
        }
    }

    func uploadFile(localURL: URL, remotePath: String) async throws {
        guard let client else { throw SSHError.unsupported("SFTP requires a direct connection") }
        let data = try Data(contentsOf: localURL)
        let sftp = try await client.openSFTP()
        try await sftp.withFile(filePath: remotePath, flags: [.write, .create, .truncate]) { file in
            var buffer = ByteBufferAllocator().buffer(capacity: data.count)
            buffer.writeBytes(data)
            try await file.write(buffer)
        }
    }

    func deleteFile(remotePath: String) async throws {
        guard let client else { throw SSHError.unsupported("SFTP requires a direct connection") }
        let sftp = try await client.openSFTP()
        try await sftp.remove(at: remotePath)
    }

    func createDirectory(remotePath: String) async throws {
        guard let client else { throw SSHError.unsupported("SFTP requires a direct connection") }
        let sftp = try await client.openSFTP()
        try await sftp.createDirectory(atPath: remotePath)
    }
}

// MARK: - Errors

enum SSHError: Error, LocalizedError {
    case missingCredential(String)
    case unsupported(String)
    case relayError(String)

    var errorDescription: String? {
        switch self {
        case .missingCredential(let what): return "Missing \(what)."
        case .unsupported(let what): return "\(what) is not supported yet."
        case .relayError(let msg): return "Connection failed: \(msg)"
        }
    }
}
