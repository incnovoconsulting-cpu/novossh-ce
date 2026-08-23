import Foundation
import WebRTC

struct P2PSignalMessage: Identifiable, Decodable {
    let id: String
    let from: String
    let type: String      // "offer" | "answer" | "ice-candidate"
    let data: SignalData
    let createdAt: String

    struct SignalData: Decodable {
        let sdp: String?
        let candidate: String?
        let sdpMid: String?
        let sdpMLineIndex: Int?
        let sessionName: String?
    }
}

struct P2PMessagesResponse: Decodable {
    let messages: [P2PSignalMessage]
    let count: Int
}

enum P2PConnectionState {
    case idle, offering, waitingForAnswer, connected, failed
}

private let iceServers = [RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])]

private let factory: RTCPeerConnectionFactory = {
    RTCPeerConnectionFactory.initialize()
    return RTCPeerConnectionFactory()
}()

@MainActor
final class P2PService: NSObject, ObservableObject {
    static let shared = P2PService()

    @Published var pendingMessages: [P2PSignalMessage] = []
    @Published var connectionState: P2PConnectionState = .idle
    @Published var connectedPeerId: String?
    @Published var lastOfferedSessionId: String?
    @Published var isPolling = false
    @Published var error: String?
    @Published var receivedMessages: [(fromSelf: Bool, text: String)] = []

    private var pollTask: Task<Void, Never>?
    private var peerConnection: RTCPeerConnection?
    private var dataChannel: RTCDataChannel?
    private var remotePeerId: String?
    private var seenMessageIds = Set<String>()

    private override init() {}

    // MARK: - Peer connection setup

    private func makePeerConnection(remotePeerId: String) -> RTCPeerConnection {
        let config = RTCConfiguration()
        config.iceServers = iceServers
        config.sdpSemantics = .unifiedPlan

        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let pc = factory.peerConnection(with: config, constraints: constraints, delegate: nil)!
        pc.delegate = self
        self.peerConnection = pc
        self.remotePeerId = remotePeerId
        return pc
    }

    private func wireDataChannel(_ channel: RTCDataChannel) {
        dataChannel = channel
        channel.delegate = self
    }

    // MARK: - Signaling

    func sendOffer(toPeerId: String, sessionName: String) async {
        connectionState = .offering
        let pc = makePeerConnection(remotePeerId: toPeerId)

        let dcConfig = RTCDataChannelConfiguration()
        guard let channel = pc.dataChannel(forLabel: "terminal", configuration: dcConfig) else {
            error = "Failed to create data channel"
            connectionState = .failed
            return
        }
        wireDataChannel(channel)

        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        do {
            let offer = try await pc.offer(for: constraints)
            try await pc.setLocalDescription(offer)

            guard let url = apiURL("/api/p2p/signal") else { return }
            let offerData: [String: Any] = ["sessionName": sessionName, "sdp": offer.sdp]
            let body: [String: Any] = ["to": toPeerId, "type": "offer", "data": offerData]
            let data = try await post(url, body: body)
            struct R: Decodable { let messageId: String }
            let r = try JSONDecoder().decode(R.self, from: data)
            lastOfferedSessionId = r.messageId
            connectionState = .waitingForAnswer
        } catch {
            self.error = error.localizedDescription
            connectionState = .failed
        }
    }

    func acceptOffer(_ message: P2PSignalMessage) async {
        guard let sdp = message.data.sdp else { return }
        let pc = makePeerConnection(remotePeerId: message.from)

        do {
            let remoteDesc = RTCSessionDescription(type: .offer, sdp: sdp)
            try await pc.setRemoteDescription(remoteDesc)

            let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
            let answer = try await pc.answer(for: constraints)
            try await pc.setLocalDescription(answer)

            guard let url = apiURL("/api/p2p/signal") else { return }
            let answerData: [String: Any] = ["sdp": answer.sdp]
            let body: [String: Any] = ["to": message.from, "type": "answer", "data": answerData]
            _ = try await post(url, body: body)

            connectedPeerId = message.from
            pendingMessages.removeAll { $0.id == message.id }
        } catch {
            self.error = error.localizedDescription
            connectionState = .failed
        }
    }

    func declineOffer(messageId: String) async {
        guard let url = apiURL("/api/p2p/signal/\(messageId)") else { return }
        do { try await deleteReq(url) }
        catch {}
        pendingMessages.removeAll { $0.id == messageId }
    }

    func send(text: String) {
        guard let channel = dataChannel, channel.readyState == .open else { return }
        let buffer = RTCDataBuffer(data: Data(text.utf8), isBinary: false)
        channel.sendData(buffer)
        receivedMessages.append((fromSelf: true, text: text))
    }

    func disconnect() {
        dataChannel?.close()
        peerConnection?.close()
        dataChannel = nil
        peerConnection = nil
        remotePeerId = nil
        connectedPeerId = nil
        connectionState = .idle
        lastOfferedSessionId = nil
        receivedMessages = []
    }

    // MARK: - Polling

    func startPolling() {
        guard !isPolling else { return }
        isPolling = true
        pollTask = Task {
            while !Task.isCancelled {
                await pollMessages()
                try? await Task.sleep(nanoseconds: 4_000_000_000) // 4s
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        isPolling = false
    }

    private func pollMessages() async {
        guard let url = apiURL("/api/p2p/messages") else { return }
        do {
            let data = try await get(url)
            let resp = try JSONDecoder().decode(P2PMessagesResponse.self, from: data)

            for msg in resp.messages {
                guard !seenMessageIds.contains(msg.id) else { continue }
                seenMessageIds.insert(msg.id)

                switch msg.type {
                case "offer":
                    pendingMessages.append(msg)
                case "answer":
                    if connectionState == .waitingForAnswer, let sdp = msg.data.sdp, let pc = peerConnection {
                        let remoteDesc = RTCSessionDescription(type: .answer, sdp: sdp)
                        try? await pc.setRemoteDescription(remoteDesc)
                    }
                case "ice-candidate":
                    if msg.from == remotePeerId, let pc = peerConnection,
                       let candidateStr = msg.data.candidate {
                        let candidate = RTCIceCandidate(
                            sdp: candidateStr,
                            sdpMLineIndex: Int32(msg.data.sdpMLineIndex ?? 0),
                            sdpMid: msg.data.sdpMid
                        )
                        try? await pc.add(candidate)
                    }
                default:
                    break
                }
            }
        } catch {}
    }

    private func signalIceCandidate(_ candidate: RTCIceCandidate) {
        guard let peerId = remotePeerId, let url = apiURL("/api/p2p/signal") else { return }
        let data: [String: Any] = [
            "candidate": candidate.sdp,
            "sdpMid": candidate.sdpMid as Any,
            "sdpMLineIndex": candidate.sdpMLineIndex,
        ]
        let body: [String: Any] = ["to": peerId, "type": "ice-candidate", "data": data]
        Task { try? await post(url, body: body) }
    }

    // MARK: - HTTP helpers

    private func apiURL(_ path: String) -> URL? {
        let base = APIService.shared.baseURL
        guard !base.isEmpty else { return nil }
        return URL(string: base + path)
    }

    private func get(_ url: URL) async throws -> Data {
        let req = URLRequest(url: url)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func post(_ url: URL, body: [String: Any]) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func deleteReq(_ url: URL) async throws {
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        _ = try await APIService.shared.authenticatedData(for: req)
    }
}

// MARK: - RTCPeerConnectionDelegate

extension P2PService: RTCPeerConnectionDelegate {
    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        Task { @MainActor in
            self.signalIceCandidate(candidate)
        }
    }

    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        Task { @MainActor in
            switch newState {
            case .connected, .completed:
                self.connectionState = .connected
            case .failed, .closed, .disconnected:
                if self.connectionState != .idle {
                    self.connectionState = .failed
                }
            default:
                break
            }
        }
    }

    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        Task { @MainActor in
            self.wireDataChannel(dataChannel)
        }
    }

    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    nonisolated func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
}

// MARK: - RTCDataChannelDelegate

extension P2PService: RTCDataChannelDelegate {
    nonisolated func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        Task { @MainActor in
            if dataChannel.readyState == .open {
                self.connectionState = .connected
            }
        }
    }

    nonisolated func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        guard let text = String(data: buffer.data, encoding: .utf8) else { return }
        Task { @MainActor in
            self.receivedMessages.append((fromSelf: false, text: text))
        }
    }
}
