import Foundation

struct AuditEvent: Identifiable, Decodable {
    let id: String
    let action: String
    let resource_type: String?
    let resource_id: String?
    let details: String?
    let ip_address: String?
    let created_at: String
}

@MainActor
final class AuditLogService: ObservableObject {
    static let shared = AuditLogService()

    @Published var events: [AuditEvent] = []
    @Published var isLoading = false
    @Published var hasMore = true
    @Published var error: String?

    private var offset = 0
    private let limit = 50

    private init() {}

    func fetchFirst(teamId: String? = nil) async {
        offset = 0
        events = []
        hasMore = true
        await fetch(teamId: teamId)
    }

    func fetchMore(teamId: String? = nil) async {
        guard hasMore, !isLoading else { return }
        await fetch(teamId: teamId)
    }

    private func fetch(teamId: String?) async {
        var path = "/api/audit-logs/logs?limit=\(limit)&offset=\(offset)"
        if let t = teamId { path += "&teamId=\(t)" }
        guard let url = apiURL(path) else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let data = try await get(url)
            struct Resp: Decodable { let data: [AuditEvent]; let count: Int }
            let resp = try JSONDecoder().decode(Resp.self, from: data)
            events.append(contentsOf: resp.data)
            offset += resp.data.count
            hasMore = resp.data.count == limit
        } catch {
            self.error = error.localizedDescription
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
}
