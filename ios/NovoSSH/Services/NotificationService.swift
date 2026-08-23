import Foundation

struct AppNotification: Identifiable, Codable {
    let id: String
    let type: String
    let title: String
    let message: String
    let isRead: Bool
    let createdAt: String
}

@MainActor
final class NotificationService: ObservableObject {
    static let shared = NotificationService()

    @Published var notifications: [AppNotification] = []
    @Published var unreadCount: Int = 0
    @Published var error: String?

    private var pollTask: Task<Void, Never>?

    private init() {}

    func fetch() async {
        guard let url = apiURL("/api/notifications?limit=50") else { return }
        do {
            let data = try await get(url)
            struct Response: Decodable { let notifications: [AppNotification] }
            let resp = try JSONDecoder().decode(Response.self, from: data)
            notifications = resp.notifications
            unreadCount = resp.notifications.filter { !$0.isRead }.count
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markRead(id: String) async {
        guard let url = apiURL("/api/notifications/\(id)/read") else { return }
        _ = try? await post(url, body: nil)
        if let i = notifications.firstIndex(where: { $0.id == id }) {
            let n = notifications[i]
            notifications[i] = AppNotification(id: n.id, type: n.type, title: n.title,
                                                message: n.message, isRead: true, createdAt: n.createdAt)
            unreadCount = max(0, unreadCount - 1)
        }
    }

    func delete(id: String) async {
        guard let url = apiURL("/api/notifications/\(id)") else { return }
        _ = try? await delete(url)
        notifications.removeAll { $0.id == id }
    }

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                await fetchUnreadCount()
                try? await Task.sleep(nanoseconds: 60_000_000_000)
            }
        }
    }

    func stopPolling() { pollTask?.cancel() }

    private func fetchUnreadCount() async {
        guard let url = apiURL("/api/notifications/unread-count") else { return }
        guard let data = try? await get(url) else { return }
        struct Resp: Decodable { let count: Int }
        if let resp = try? JSONDecoder().decode(Resp.self, from: data) {
            unreadCount = resp.count
        }
    }

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

    private func post(_ url: URL, body: Data?) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        if let body { req.httpBody = body; req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func delete(_ url: URL) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }
}
