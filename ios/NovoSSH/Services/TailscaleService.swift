import Foundation
import Network

/// Manages the device's Headscale node registration and Tailscale IP resolution.
/// The actual mesh routing happens on the backend — this service only handles
/// fetching auth credentials so the backend can associate this user with their node.
@MainActor
final class TailscaleService: ObservableObject {
    static let shared = TailscaleService()

    @Published private(set) var nodeIP: String?
    @Published private(set) var isReady = false

    private var fetchTask: Task<Void, Never>?

    private init() {}

    /// Called after login — silently resolves the user's Headscale node IP.
    func prepare(accessToken: String) {
        fetchTask?.cancel()
        fetchTask = Task {
            await fetchNodeIP(accessToken: accessToken)
        }
    }

    func reset() {
        fetchTask?.cancel()
        nodeIP = nil
        isReady = false
    }

    /// Returns the resolved Tailscale IP for the given SSH host address.
    /// If the address is already a Tailscale IP or public, returns it unchanged.
    /// If private, returns nil — the relay will resolve it via Headscale.
    func resolvedAddress(for hostAddress: String) -> String? {
        if NetworkClassifier.isTailscaleIP(hostAddress) { return hostAddress }
        if !NetworkClassifier.isPrivateIPRange(hostAddress) { return hostAddress }
        return nil // backend relay handles private-to-Headscale routing
    }

    // MARK: - Private

    private func fetchNodeIP(accessToken: String) async {
        guard let url = URL(string: "\(APIService.shared.baseURL)/api/tailscale/status") else { return }

        var req = URLRequest(url: url)
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            if let ip = json?["nodeIP"] as? String, !ip.isEmpty {
                self.nodeIP = ip
                self.isReady = true
            }
        } catch {
            // Non-fatal — relay works without a registered node IP
        }
    }
}
