import SwiftUI

struct AuditLogView: View {
    @StateObject private var service = AuditLogService.shared
    @State private var filterAction = ""

    private var filtered: [AuditEvent] {
        guard !filterAction.isEmpty else { return service.events }
        return service.events.filter {
            $0.action.localizedCaseInsensitiveContains(filterAction) ||
            ($0.resource_type ?? "").localizedCaseInsensitiveContains(filterAction)
        }
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if service.isLoading && service.events.isEmpty {
                ProgressView().tint(Theme.accent)
            } else if service.events.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.textStrong.opacity(0.3))
                    Text("No audit events")
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
            } else {
                List {
                    ForEach(filtered) { event in
                        AuditRow(event: event)
                            .listRowBackground(Theme.panel)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    }

                    if service.hasMore {
                        Button {
                            Task { await service.fetchMore() }
                        } label: {
                            HStack {
                                Spacer()
                                if service.isLoading {
                                    ProgressView().tint(Theme.accent)
                                } else {
                                    Text("Load more")
                                        .font(.caption)
                                        .foregroundStyle(Theme.accent)
                                }
                                Spacer()
                            }
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .scrollContentBackground(.hidden)
                .refreshable { await service.fetchFirst() }
                .searchable(text: $filterAction, prompt: "Filter by action or resource…")
            }
        }
        .navigationTitle("Audit Log")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await service.fetchFirst() }
    }
}

private struct AuditRow: View {
    let event: AuditEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(event.action)
                        .font(.system(.caption, design: .monospaced, weight: .semibold))
                        .foregroundStyle(actionColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(actionColor.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                    if let rt = event.resource_type {
                        Text(rt)
                            .font(.caption2)
                            .foregroundStyle(Theme.textStrong.opacity(0.5))
                    }
                }

                if let details = event.details, !details.isEmpty {
                    Text(details)
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.7))
                        .lineLimit(2)
                }

                HStack(spacing: 8) {
                    if let ip = event.ip_address {
                        Text(ip)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Theme.textStrong.opacity(0.35))
                    }
                    Text(relativeDate(event.created_at))
                        .font(.caption2)
                        .foregroundStyle(Theme.textStrong.opacity(0.35))
                }
            }
        }
    }

    private var actionColor: Color {
        switch event.action.lowercased() {
        case let a where a.contains("delete") || a.contains("remove"): return .red
        case let a where a.contains("create") || a.contains("add"): return .green
        case let a where a.contains("login") || a.contains("auth"): return Theme.accent
        default: return .orange
        }
    }

    private func relativeDate(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fmt.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        let diff = Date().timeIntervalSince(date)
        switch diff {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(diff / 60))m ago"
        case ..<86400: return "\(Int(diff / 3600))h ago"
        default: return "\(Int(diff / 86400))d ago"
        }
    }
}
