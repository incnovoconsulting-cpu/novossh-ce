import SwiftUI

struct SessionListView: View {
    @StateObject private var service = SessionPlaybackService.shared
    @State private var selected: SessionSummary?

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if service.isLoading && service.sessions.isEmpty {
                ProgressView().tint(Theme.accent)
            } else if service.sessions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "play.rectangle.on.rectangle")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.textStrong.opacity(0.3))
                    Text("No sessions recorded")
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
            } else {
                List(service.sessions) { session in
                    Button {
                        selected = session
                    } label: {
                        SessionRow(session: session)
                    }
                    .listRowBackground(Theme.panel)
                }
                .scrollContentBackground(.hidden)
                .refreshable { await service.fetchSessions() }
            }
        }
        .navigationTitle("Session Playback")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await service.fetchSessions() }
        .navigationDestination(item: $selected) { session in
            SessionPlaybackView(session: session)
        }
    }
}

private struct SessionRow: View {
    let session: SessionSummary

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: session.is_active ? "record.circle" : "play.circle")
                .foregroundStyle(session.is_active ? .red : Theme.accent)
                .font(.title3)

            VStack(alignment: .leading, spacing: 3) {
                Text(session.name ?? "Unnamed Session")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.textStrong)
                HStack(spacing: 8) {
                    if let count = session.commandCount {
                        Label("\(count) cmds", systemImage: "terminal")
                            .font(.caption)
                            .foregroundStyle(Theme.textStrong.opacity(0.5))
                    }
                    Text(relativeDate(session.created_at))
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.4))
                }
            }

            Spacer()

            if session.is_active {
                Text("LIVE")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.red.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        }
        .padding(.vertical, 2)
    }

    private func relativeDate(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fmt.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        let diff = Date().timeIntervalSince(date)
        switch diff {
        case ..<3600: return "\(Int(diff / 60))m ago"
        case ..<86400: return "\(Int(diff / 3600))h ago"
        default: return "\(Int(diff / 86400))d ago"
        }
    }
}
