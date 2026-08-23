import SwiftUI

struct SessionLogView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        Group {
            if store.sessionLogs.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No sessions yet").font(.headline).foregroundStyle(.secondary)
                    Text("Start an SSH connection to see history here").font(.caption).foregroundStyle(.tertiary)
                    Spacer()
                }
            } else {
                List {
                    ForEach(store.sessionLogs) { log in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(log.hostLabel).font(.headline)
                                Spacer()
                                if log.bookmarked {
                                    Image(systemName: "bookmark.fill")
                                        .foregroundStyle(Color.accentColor)
                                        .font(.caption)
                                }
                            }
                            Text(log.endedAt?.relativeShort ?? log.startedAt.relativeShort)
                                .font(.caption).foregroundStyle(.secondary)
                            if log.commandCount > 0 {
                                Text("\(log.commandCount) commands")
                                    .font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button {
                                if log.bookmarked {
                                    store.unbookmarkLog(log.id)
                                } else {
                                    store.bookmarkLog(log.id)
                                }
                            } label: {
                                Image(systemName: log.bookmarked ? "bookmark.slash" : "bookmark.fill")
                            }
                            .tint(log.bookmarked ? .gray : .yellow)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("History")
    }
}
