import Foundation

struct SessionMetrics: Decodable {
    struct Trend: Decodable {
        let totalSessions: Int?
        let avgDuration: Double?
        let totalCommands: Int?
    }
    let totalSessions: Int?
    let avgDuration: Double?
    let totalCommands: Int?
    let trend: Trend?
}

struct TopCommand: Decodable, Identifiable {
    var id: String { command }
    let command: String
    let count: Int
    let successRate: Double?
}

struct HeatmapCell: Decodable {
    let hour: Int
    let day: Int
    let value: Int
}

struct ConnectionPoint: Decodable, Identifiable {
    var id: String { date }
    let date: String
    let count: Int
}

@MainActor
final class AnalyticsService: ObservableObject {
    static let shared = AnalyticsService()

    @Published var sessionMetrics: SessionMetrics?
    @Published var topCommands: [TopCommand] = []
    @Published var heatmap: [HeatmapCell] = []
    @Published var isLoading = false
    @Published var error: String?

    private init() {}

    func fetchAll(days: Int = 30) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.fetchSessionMetrics(days: days) }
            group.addTask { await self.fetchTopCommands(days: days) }
            group.addTask { await self.fetchHeatmap() }
        }
    }

    private func fetchSessionMetrics(days: Int) async {
        guard let url = apiURL("/api/analytics/sessions?days=\(days)") else { return }
        guard let data = try? await get(url) else { return }
        struct Resp: Decodable { let data: SessionMetrics? }
        sessionMetrics = (try? JSONDecoder().decode(Resp.self, from: data))?.data
    }

    private func fetchTopCommands(days: Int) async {
        guard let url = apiURL("/api/analytics/commands?days=\(days)") else { return }
        guard let data = try? await get(url) else { return }
        struct Inner: Decodable { let topCommands: [TopCommand]? }
        struct Resp: Decodable { let data: Inner? }
        topCommands = (try? JSONDecoder().decode(Resp.self, from: data))?.data?.topCommands ?? []
    }

    private func fetchHeatmap() async {
        guard let url = apiURL("/api/analytics/heatmap") else { return }
        guard let data = try? await get(url) else { return }
        struct Inner: Decodable { let heatmap: [HeatmapCell]? }
        struct Resp: Decodable { let data: Inner? }
        heatmap = (try? JSONDecoder().decode(Resp.self, from: data))?.data?.heatmap ?? []
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
