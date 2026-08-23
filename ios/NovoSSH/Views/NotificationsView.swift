import SwiftUI

struct NotificationsView: View {
    @StateObject private var service = NotificationService.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if service.notifications.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "bell.slash")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.textStrong.opacity(0.3))
                    Text("No notifications")
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
            } else {
                List {
                    ForEach(service.notifications) { note in
                        NotificationRow(note: note)
                            .listRowBackground(Theme.panel)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .onTapGesture {
                                if !note.isRead {
                                    Task { await service.markRead(id: note.id) }
                                }
                            }
                    }
                    .onDelete { offsets in
                        let ids = offsets.map { service.notifications[$0].id }
                        ids.forEach { id in Task { await service.delete(id: id) } }
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Notifications")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
                    .foregroundStyle(Theme.accent)
            }
        }
        .task { await service.fetch() }
        .refreshable { await service.fetch() }
    }
}

private struct NotificationRow: View {
    let note: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(note.isRead ? Color.clear : Theme.accent)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(note.title)
                    .font(.subheadline.weight(note.isRead ? .regular : .semibold))
                    .foregroundStyle(Theme.textStrong)
                Text(note.message)
                    .font(.caption)
                    .foregroundStyle(Theme.textStrong.opacity(0.65))
                    .lineLimit(2)
            }

            Spacer()

            Text(relativeDate(note.createdAt))
                .font(.caption2)
                .foregroundStyle(Theme.textStrong.opacity(0.4))
        }
    }

    private func relativeDate(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        guard let date = fmt.date(from: iso) else { return "" }
        let diff = Date().timeIntervalSince(date)
        switch diff {
        case ..<60: return "now"
        case ..<3600: return "\(Int(diff / 60))m"
        case ..<86400: return "\(Int(diff / 3600))h"
        default: return "\(Int(diff / 86400))d"
        }
    }
}
