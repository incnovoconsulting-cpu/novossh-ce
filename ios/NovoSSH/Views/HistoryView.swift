import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: AppStore
    @State private var navigationHost: Host?

    var recent: [Host] {
        store.hosts
            .filter { $0.lastConnectedAt != nil }
            .sorted { ($0.lastConnectedAt ?? .distantPast) > ($1.lastConnectedAt ?? .distantPast) }
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if recent.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.largeTitle)
                        .foregroundStyle(.white.opacity(0.5))
                    Text("No session history yet").foregroundStyle(.white.opacity(0.7))
                    Text("Hosts you connect to will appear here.")
                        .font(.footnote).foregroundStyle(.white.opacity(0.45))
                }
            } else {
                List {
                    ForEach(recent) { h in
                        HostRow(host: h, action: { navigationHost = h })
                            .listRowBackground(Theme.panel)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("History")
        .navigationDestination(item: $navigationHost) { h in
            TerminalSessionView(host: h)
        }
    }
}
