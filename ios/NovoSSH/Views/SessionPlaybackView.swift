import SwiftUI

struct SessionPlaybackView: View {
    let session: SessionSummary
    @StateObject private var service = SessionPlaybackService.shared
    @State private var currentFrameIndex = 0
    @State private var isPlaying = false
    @State private var speed: Double = 1.0
    @State private var playTimer: Timer?
    @State private var displayedText = ""

    private var data: SessionPlaybackData? { service.playbackData }
    private var frames: [PlaybackFrame] { data?.frames ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            // Terminal replay area
            ScrollViewReader { proxy in
                ScrollView {
                    Text(displayedText)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(Color(hex: "#e2e8f0"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .id("bottom")
                }
                .background(Color(hex: "#0d1117"))
                .onChange(of: displayedText) { _, _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
            }

            Divider().background(Theme.stroke)

            // Playback controls
            if let data = data {
                PlaybackControls(
                    currentIndex: $currentFrameIndex,
                    totalFrames: frames.count,
                    totalDuration: data.totalDuration,
                    isPlaying: $isPlaying,
                    speed: $speed,
                    onSeek: { index in seek(to: index) },
                    onPlayPause: { togglePlayback() }
                )
            } else if service.isLoading {
                HStack {
                    ProgressView().tint(Theme.accent)
                    Text("Loading playback…")
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
                .padding()
            } else if let error = service.error {
                ContentUnavailableView(
                    "Couldn't load playback",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else {
                ContentUnavailableView(
                    "No playback data",
                    systemImage: "play.slash",
                    description: Text("This session has no recorded commands yet.")
                )
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle(session.name ?? "Session Playback")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await service.fetchPlayback(sessionId: session.id) }
        .onChange(of: service.playbackData?.sessionId) { _, _ in resetPlayback() }
        .onDisappear { stopPlayback() }
    }

    private func resetPlayback() {
        currentFrameIndex = 0
        displayedText = ""
        isPlaying = false
    }

    private func seek(to index: Int) {
        stopPlayback()
        currentFrameIndex = min(index, frames.count - 1)
        displayedText = frames[0..<currentFrameIndex]
            .compactMap { frame -> String? in
                switch frame.type {
                case "command": return frame.command.map { "$ \($0)\n" }
                case "output": return frame.output
                default: return nil
                }
            }
            .joined()
    }

    private func togglePlayback() {
        if isPlaying { stopPlayback() } else { startPlayback() }
    }

    private func startPlayback() {
        guard !frames.isEmpty, currentFrameIndex < frames.count else {
            resetPlayback(); return
        }
        isPlaying = true
        scheduleNextFrame()
    }

    private func scheduleNextFrame() {
        guard isPlaying, currentFrameIndex < frames.count else {
            isPlaying = false; return
        }
        let frame = frames[currentFrameIndex]
        appendFrame(frame)
        currentFrameIndex += 1

        guard currentFrameIndex < frames.count else { isPlaying = false; return }

        let nextDelay = (frames[currentFrameIndex].timestamp - frame.timestamp) / (speed * 1000.0)
        let clampedDelay = min(max(nextDelay, 0.01), 2.0)
        playTimer = Timer.scheduledTimer(withTimeInterval: clampedDelay, repeats: false) { _ in
            Task { @MainActor in self.scheduleNextFrame() }
        }
    }

    private func stopPlayback() {
        playTimer?.invalidate()
        playTimer = nil
        isPlaying = false
    }

    private func appendFrame(_ frame: PlaybackFrame) {
        switch frame.type {
        case "command":
            if let cmd = frame.command { displayedText += "$ \(cmd)\n" }
        case "output":
            if let out = frame.output { displayedText += out }
        default: break
        }
    }
}

private struct PlaybackControls: View {
    @Binding var currentIndex: Int
    let totalFrames: Int
    let totalDuration: Double
    @Binding var isPlaying: Bool
    @Binding var speed: Double
    let onSeek: (Int) -> Void
    let onPlayPause: () -> Void

    private let speeds: [Double] = [0.5, 1.0, 1.5, 2.0, 4.0]

    var body: some View {
        VStack(spacing: 8) {
            Slider(
                value: Binding(
                    get: { Double(currentIndex) },
                    set: { onSeek(Int($0)) }
                ),
                in: 0...Double(max(totalFrames - 1, 1)),
                step: 1
            )
            .tint(Theme.accent)
            .padding(.horizontal)

            HStack(spacing: 20) {
                Button { onPlayPause() } label: {
                    Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Theme.accent)
                }

                Button {
                    onSeek(0)
                } label: {
                    Image(systemName: "backward.end.fill")
                        .font(.title3)
                        .foregroundStyle(Theme.textStrong.opacity(0.6))
                }

                Spacer()

                Text("\(currentIndex)/\(totalFrames)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.textStrong.opacity(0.5))

                Spacer()

                Menu {
                    ForEach(speeds, id: \.self) { s in
                        Button {
                            speed = s
                        } label: {
                            if s == speed { Label("\(s, specifier: "%.1f")×", systemImage: "checkmark") }
                            else { Text("\(s, specifier: "%.1f")×") }
                        }
                    }
                } label: {
                    Text("\(speed, specifier: "%.1f")×")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Theme.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 10)
        .background(Theme.panel)
    }
}
