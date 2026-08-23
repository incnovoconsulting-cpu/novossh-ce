import Foundation

struct SessionSummary: Identifiable, Decodable, Hashable {
    let id: String
    let name: String?
    let description: String?
    let is_active: Bool
    let created_at: String
    let ended_at: String?
    let commandCount: Int?
}

struct PlaybackFrame: Decodable {
    let type: String        // "command" | "output" | "sync"
    let timestamp: Double   // ms since session start
    let command: String?
    let output: String?
    let exitCode: Int?
}

struct SessionPlaybackData: Decodable {
    let sessionId: String
    let totalDuration: Double  // ms
    let commandCount: Int
    let participantCount: Int
    let frames: [PlaybackFrame]
}

@MainActor
final class SessionPlaybackService: ObservableObject {
    static let shared = SessionPlaybackService()

    @Published var sessions: [SessionSummary] = []
    @Published var playbackData: SessionPlaybackData?
    @Published var isLoading = false
    @Published var error: String?

    private init() {}

    func fetchSessions() async {
        guard let url = apiURL("/api/sessions") else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let data = try await get(url)
            sessions = try JSONDecoder().decode([SessionSummary].self, from: data)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchPlayback(sessionId: String) async {
        guard let url = apiURL("/api/sessions/\(sessionId)/playback") else { return }
        isLoading = true
        error = nil
        playbackData = nil
        defer { isLoading = false }
        do {
            let data = try await get(url)
            playbackData = try JSONDecoder().decode(SessionPlaybackData.self, from: data)
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
