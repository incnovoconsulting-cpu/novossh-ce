import SwiftUI

struct AnalyticsDashboardView: View {
    @StateObject private var service = AnalyticsService.shared
    @State private var selectedDays = 30
    private let dayOptions = [7, 14, 30, 90]

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Time range picker
                    Picker("Range", selection: $selectedDays) {
                        ForEach(dayOptions, id: \.self) { d in
                            Text("\(d)d").tag(d)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .onChange(of: selectedDays) { _, days in
                        Task { await service.fetchAll(days: days) }
                    }

                    if service.isLoading && service.sessionMetrics == nil {
                        ProgressView().tint(Theme.accent).padding(40)
                    } else if service.sessionMetrics == nil && service.topCommands.isEmpty && service.heatmap.isEmpty {
                        ContentUnavailableView(
                            "No analytics yet",
                            systemImage: "chart.bar.xaxis",
                            description: Text("Connect to a host and run some commands to see activity here.")
                        )
                        .padding(.top, 40)
                    } else {
                        // Overview cards
                        if let m = service.sessionMetrics {
                            OverviewCards(metrics: m)
                        }

                        // Top commands
                        if !service.topCommands.isEmpty {
                            CommandsCard(commands: service.topCommands)
                        }

                        // Activity heatmap
                        if !service.heatmap.isEmpty {
                            HeatmapCard(cells: service.heatmap)
                        }
                    }
                }
                .padding(.vertical, 16)
            }
        }
        .navigationTitle("Analytics")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await service.fetchAll(days: selectedDays) }
        .refreshable { await service.fetchAll(days: selectedDays) }
    }
}

// MARK: - Overview stat cards

private struct OverviewCards: View {
    let metrics: SessionMetrics

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            StatCard(title: "Sessions", value: "\(metrics.totalSessions ?? 0)", icon: "play.circle", trend: metrics.trend?.totalSessions)
            StatCard(title: "Commands", value: "\(metrics.totalCommands ?? 0)", icon: "terminal", trend: metrics.trend?.totalCommands)
            StatCard(title: "Avg Duration", value: formatDuration(metrics.avgDuration ?? 0), icon: "clock", trend: nil)
        }
        .padding(.horizontal)
    }

    private func formatDuration(_ ms: Double) -> String {
        let s = Int(ms / 1000)
        if s < 60 { return "\(s)s" }
        return "\(s / 60)m"
    }
}

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let trend: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon).foregroundStyle(Theme.accent).font(.caption)
                Spacer()
                if let t = trend {
                    Image(systemName: t >= 0 ? "arrow.up" : "arrow.down")
                        .font(.system(size: 8))
                        .foregroundStyle(t >= 0 ? .green : .red)
                }
            }
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.textStrong)
            Text(title)
                .font(.caption2)
                .foregroundStyle(Theme.textStrong.opacity(0.5))
        }
        .padding(12)
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Top commands

private struct CommandsCard: View {
    let commands: [TopCommand]
    private var maxCount: Int { commands.map(\.count).max() ?? 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Top Commands", systemImage: "terminal")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textStrong)
                .padding(.horizontal)

            VStack(spacing: 0) {
                ForEach(commands.prefix(8)) { cmd in
                    HStack(spacing: 10) {
                        Text(cmd.command)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(Theme.accent)
                            .lineLimit(1)
                            .frame(width: 120, alignment: .leading)

                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Theme.accent.opacity(0.08))
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Theme.accent.opacity(0.5))
                                    .frame(width: geo.size.width * CGFloat(cmd.count) / CGFloat(maxCount))
                            }
                        }
                        .frame(height: 8)

                        Text("\(cmd.count)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Theme.textStrong.opacity(0.5))
                            .frame(width: 36, alignment: .trailing)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 6)

                    if cmd.id != commands.prefix(8).last?.id {
                        Divider().background(Theme.stroke).padding(.horizontal)
                    }
                }
            }
            .background(Theme.panel)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal)
        }
    }
}

// MARK: - Activity heatmap

private struct HeatmapCard: View {
    let cells: [HeatmapCell]
    private let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private var maxValue: Int { cells.map(\.value).max() ?? 1 }

    private func cell(hour: Int, day: Int) -> HeatmapCell? {
        cells.first { $0.hour == hour && $0.day == day }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Activity Heatmap", systemImage: "square.grid.3x3")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textStrong)
                .padding(.horizontal)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 3) {
                    Text("").frame(width: 30)
                    ForEach(0..<24, id: \.self) { h in
                        Text(h % 6 == 0 ? "\(h)" : "")
                            .font(.system(size: 7))
                            .foregroundStyle(Theme.textStrong.opacity(0.3))
                            .frame(maxWidth: .infinity)
                    }
                }

                ForEach(0..<7) { d in
                    HStack(spacing: 3) {
                        Text(days[d])
                            .font(.system(size: 8))
                            .foregroundStyle(Theme.textStrong.opacity(0.4))
                            .frame(width: 30, alignment: .leading)

                        ForEach(0..<24, id: \.self) { h in
                            let v = cell(hour: h, day: d)?.value ?? 0
                            let intensity = CGFloat(v) / CGFloat(maxValue)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Theme.accent.opacity(intensity > 0 ? 0.1 + intensity * 0.9 : 0.04))
                                .aspectRatio(1, contentMode: .fit)
                        }
                    }
                }
            }
            .padding()
            .background(Theme.panel)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal)
        }
    }
}
