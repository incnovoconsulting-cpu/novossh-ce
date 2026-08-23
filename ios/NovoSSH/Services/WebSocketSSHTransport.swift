import Foundation

/// WebSocket-based SSH transport that relays connections through the NovoSSH backend.
/// The backend speaks this JSON protocol on /ws/ssh and proxies SSH to the target host,
/// routing through Headscale when the target is on a private network.
final class WebSocketSSHTransport: NSObject {

    // MARK: - Types

    enum State { case idle, connecting, connected, disconnected, failed(String) }

    private enum Outgoing: Encodable {
        case connect(host: String, port: Int, username: String, password: String?, privateKey: String?, passphrase: String?, certificate: String?, cols: Int, rows: Int)
        case data(String)
        case resize(cols: Int, rows: Int)
        case disconnect
        case ping

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .connect(let host, let port, let user, let pw, let key, let pass, let cert, let cols, let rows):
                try c.encode("connect", forKey: .type)
                try c.encode(host, forKey: .host)
                try c.encode(port, forKey: .port)
                try c.encode(user, forKey: .username)
                if let pw { try c.encode(pw, forKey: .password) }
                if let key { try c.encode(key, forKey: .privateKey) }
                if let pass { try c.encode(pass, forKey: .passphrase) }
                if let cert { try c.encode(cert, forKey: .certificate) }
                try c.encode(cols, forKey: .cols)
                try c.encode(rows, forKey: .rows)
            case .data(let d):
                try c.encode("data", forKey: .type)
                try c.encode(d, forKey: .data)
            case .resize(let cols, let rows):
                try c.encode("resize", forKey: .type)
                try c.encode(cols, forKey: .cols)
                try c.encode(rows, forKey: .rows)
            case .disconnect:
                try c.encode("disconnect", forKey: .type)
            case .ping:
                try c.encode("ping", forKey: .type)
            }
        }

        enum CodingKeys: String, CodingKey {
            case type, host, port, username, password, privateKey, passphrase, certificate, data, cols, rows
        }
    }

    private struct Incoming: Decodable {
        let type: String
        let status: String?
        let message: String?
        let data: String?
    }

    // MARK: - Public interface

    var onData: ((Data) -> Void)?
    var onStateChange: ((State) -> Void)?

    private(set) var state: State = .idle {
        didSet { onStateChange?(state) }
    }

    // MARK: - Private

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var pingTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?

    // MARK: - Connection

    func connect(
        relayURL: String,
        authToken: String,
        host: String,
        port: Int,
        username: String,
        password: String? = nil,
        privateKey: String? = nil,
        passphrase: String? = nil,
        certificate: String? = nil,
        cols: Int = 80,
        rows: Int = 24
    ) {
        guard var components = URLComponents(string: relayURL.replacingOccurrences(of: "https://", with: "wss://")
                                                              .replacingOccurrences(of: "http://", with: "ws://")) else {
            state = .failed("Invalid relay URL")
            return
        }
        components.path = "/ws/ssh"
        components.queryItems = [URLQueryItem(name: "token", value: authToken)]

        guard let url = components.url else {
            state = .failed("Could not build WebSocket URL")
            return
        }

        state = .connecting
        let urlSession = URLSession(configuration: .default, delegate: nil, delegateQueue: nil)
        self.session = urlSession

        let task = urlSession.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        startReceiving()
        startPing()

        // Send connect message
        send(.connect(host: host, port: port, username: username, password: password, privateKey: privateKey, passphrase: passphrase, certificate: certificate, cols: cols, rows: rows))
    }

    func sendData(_ data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        send(.data(text))
    }

    func sendResize(cols: Int, rows: Int) {
        send(.resize(cols: cols, rows: rows))
    }

    func disconnect() {
        send(.disconnect)
        teardown()
    }

    // MARK: - Private helpers

    private func send(_ msg: Outgoing) {
        guard let socket = webSocket else { return }
        guard let data = try? JSONEncoder().encode(msg),
              let text = String(data: data, encoding: .utf8) else { return }
        socket.send(.string(text)) { _ in }
    }

    private func startReceiving() {
        receiveTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                guard let socket = self.webSocket else { break }
                do {
                    let message = try await socket.receive()
                    guard !Task.isCancelled else { break }
                    switch message {
                    case .string(let text):
                        self.handle(text: text)
                    case .data(let d):
                        if let text = String(data: d, encoding: .utf8) { self.handle(text: text) }
                    @unknown default:
                        break
                    }
                } catch {
                    if !Task.isCancelled {
                        await MainActor.run { self.state = .failed(error.localizedDescription) }
                    }
                    break
                }
            }
        }
    }

    private func handle(text: String) {
        guard let data = text.data(using: .utf8),
              let msg = try? JSONDecoder().decode(Incoming.self, from: data) else { return }

        Task { @MainActor [weak self] in
            guard let self else { return }
            switch msg.type {
            case "status":
                switch msg.status {
                case "connected":   self.state = .connected
                case "disconnected": self.teardown(); self.state = .disconnected
                default: break
                }
            case "data":
                if let d = msg.data, let bytes = d.data(using: .utf8) {
                    self.onData?(bytes)
                }
            case "error":
                self.state = .failed(msg.message ?? "Unknown relay error")
                self.teardown()
            default:
                break
            }
        }
    }

    private func startPing() {
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                guard !Task.isCancelled else { break }
                self?.send(.ping)
            }
        }
    }

    private func teardown() {
        pingTask?.cancel()
        receiveTask?.cancel()
        pingTask = nil
        receiveTask = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        session?.invalidateAndCancel()
        session = nil
    }
}
