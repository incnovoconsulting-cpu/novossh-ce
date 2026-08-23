import Foundation

struct Subscription: Decodable, Equatable {
    let plan: String          // "free" | "starter" | "pro"
    let status: String        // "active" | "past_due" | "canceled"
    let usage: [String: Int]?
}

struct QuotaStatus: Decodable, Identifiable {
    var id: String { resourceType }
    let resourceType: String
    let currentUsage: Int
    let hardLimit: Int
    let softLimitWarning: Int?
    let softLimitCritical: Int?
    let usagePercent: Double
    let exceeded: Bool
    let status: String        // "ok" | "warning" | "critical"
}

struct UsageCurrentResponse: Decodable {
    let statuses: [QuotaStatus]
}

@MainActor
final class BillingService: ObservableObject {
    static let shared = BillingService()

    @Published var subscription: Subscription?
    @Published var quotas: [QuotaStatus] = []
    @Published var isLoading = false
    @Published var error: String?

    private init() {}

    func fetchAll() async {
        isLoading = true; defer { isLoading = false }
        async let sub: () = fetchSubscription()
        async let usage: () = fetchUsage()
        _ = await (sub, usage)
    }

    private func fetchSubscription() async {
        guard let url = apiURL("/api/billing/subscription") else { return }
        do {
            let data = try await get(url)
            subscription = try JSONDecoder().decode(Subscription.self, from: data)
        } catch {
            let code = (error as? URLError)?.code
            if code == .cancelled || code == .timedOut { return }
            if let urlError = error as? URLError,
               urlError.code == .badServerResponse,
               let msg = urlError.userInfo[NSLocalizedDescriptionKey] as? String,
               msg.contains("401") {
                self.error = "Session expired. Please sign out and sign back in."
            } else {
                self.error = error.localizedDescription
            }
        }
    }

    private func fetchUsage() async {
        guard let url = apiURL("/api/billing/usage/current") else { return }
        do {
            let data = try await get(url)
            quotas = try JSONDecoder().decode(UsageCurrentResponse.self, from: data).statuses
        } catch {
            // Usage is non-critical — log but don't surface to user
            print("[BillingService] fetchUsage failed: \(error)")
        }
    }

    private func apiURL(_ path: String) -> URL? {
        let base = APIService.shared.baseURL
        guard !base.isEmpty else { return nil }
        return URL(string: base + path)
    }

    private func get(_ url: URL) async throws -> Data {
        let req = URLRequest(url: url)
        let (data, response) = try await APIService.shared.authenticatedData(for: req)
        try assertOK(response, data: data)
        return data
    }

    private func assertOK(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if let json = try? JSONDecoder().decode([String: String].self, from: data),
               let msg = json["error"] ?? json["message"] {
                throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: msg])
            }
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: "Server error (HTTP \(http.statusCode))"])
        }
    }
}
