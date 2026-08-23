import SwiftUI
import SwiftTerm

#if os(iOS)
/// SwiftTerm's own pressesBegan-based Control-key handling doesn't reliably
/// reach hardware Ctrl+<letter> combos on Mac Catalyst's keyboard/responder
/// chain. UIKeyCommand is resolved earlier in the responder chain (before
/// pressesBegan), so registering the control chords we care about here
/// guarantees they work regardless of what's happening deeper in the library.
private final class ControlKeyTerminalView: TerminalView {
    var onControlByte: ((UInt8) -> Void)?

    private static let controlChords: [(Character, UInt8)] = [
        ("c", 0x03), ("d", 0x04), ("z", 0x1a), ("l", 0x0c),
    ]

    override var keyCommands: [UIKeyCommand]? {
        let commands = Self.controlChords.map { char, _ in
            UIKeyCommand(input: String(char), modifierFlags: .control, action: #selector(handleControlChord(_:)))
        }
        return (super.keyCommands ?? []) + commands
    }

    @objc private func handleControlChord(_ command: UIKeyCommand) {
        guard let input = command.input?.lowercased().first,
              let byte = Self.controlChords.first(where: { $0.0 == input })?.1 else { return }
        onControlByte?(byte)
    }
}

struct TerminalScreen: UIViewRepresentable {
    @ObservedObject var session: SSHSession
    let palette: TerminalPalette
    let fontSize: Int

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeUIView(context: Context) -> TerminalView {
        let tv = ControlKeyTerminalView()
        applyTheme(tv)
        tv.terminalDelegate = context.coordinator
        context.coordinator.terminalView = tv
        tv.onControlByte = { [weak session] byte in
            Task { @MainActor in await session?.send(Data([byte])) }
        }

        session.onData = { [weak tv] data in
            guard let tv else { return }
            let arr = Array(data)
            tv.feed(byteArray: arr[...])
        }
        return tv
    }

    func updateUIView(_ uiView: TerminalView, context: Context) {
        applyTheme(uiView)
    }

    private func applyTheme(_ tv: TerminalView) {
        let bg = UIColor(Color(hex: palette.backgroundHex))
        let fg = UIColor(Color(hex: palette.foregroundHex))
        tv.nativeBackgroundColor = bg
        tv.nativeForegroundColor = fg
        tv.backgroundColor = bg
        tv.font = UIFont.monospacedSystemFont(ofSize: CGFloat(fontSize), weight: .regular)

        let colors: [SwiftTerm.Color] = palette.ansiHex.map { hex in
            let c = Color(hex: hex)
            let ui = UIColor(c)
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            ui.getRed(&r, green: &g, blue: &b, alpha: &a)
            return SwiftTerm.Color(red: UInt16(r * 65535),
                                   green: UInt16(g * 65535),
                                   blue: UInt16(b * 65535))
        }
        tv.installColors(colors)
    }

    final class Coordinator: NSObject, TerminalViewDelegate {
        let session: SSHSession
        weak var terminalView: TerminalView?

        init(session: SSHSession) {
            self.session = session
        }

        func send(source: TerminalView, data: ArraySlice<UInt8>) {
            let bytes = Data(data)
            Task { @MainActor in await session.send(bytes) }
        }

        func scrolled(source: TerminalView, position: Double) {}

        func setTerminalTitle(source: TerminalView, title: String) {}

        func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
            Task { @MainActor in
                try? await session.resize(cols: UInt16(newCols), rows: UInt16(newRows))
            }
        }

        func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

        func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
            guard let url = URL(string: link) else { return }
            AppOpenHelper.open(url)
        }

        func bell(source: TerminalView) {}

        func clipboardCopy(source: TerminalView, content: Data) {
            if let s = String(data: content, encoding: .utf8) {
                ClipboardHelper.setString(s)
            }
        }

        func iTermContent(source: TerminalView, content: ArraySlice<UInt8>) {}

        func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}
    }
}

#elseif os(macOS)
struct TerminalScreen: NSViewRepresentable {
    @ObservedObject var session: SSHSession
    let palette: TerminalPalette
    let fontSize: Int

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeNSView(context: Context) -> TerminalView {
        let tv = TerminalView()
        applyTheme(tv)
        tv.terminalDelegate = context.coordinator
        context.coordinator.terminalView = tv

        session.onData = { [weak tv] data in
            guard let tv else { return }
            let arr = Array(data)
            tv.feed(byteArray: arr[...])
        }
        return tv
    }

    func updateNSView(_ nsView: TerminalView, context: Context) {
        applyTheme(nsView)
    }

    private func applyTheme(_ tv: TerminalView) {
        let bg = NSColor(Color(hex: palette.backgroundHex))
        let fg = NSColor(Color(hex: palette.foregroundHex))
        tv.nativeBackgroundColor = bg
        tv.nativeForegroundColor = fg
        tv.font = NSFont.monospacedSystemFont(ofSize: CGFloat(fontSize), weight: .regular)

        let colors: [SwiftTerm.Color] = palette.ansiHex.map { hex in
            let c = Color(hex: hex)
            let ns = NSColor(c)
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            ns.getRed(&r, green: &g, blue: &b, alpha: &a)
            return SwiftTerm.Color(red: UInt16(r * 65535),
                                   green: UInt16(g * 65535),
                                   blue: UInt16(b * 65535))
        }
        tv.installColors(colors)
    }

    final class Coordinator: NSObject, TerminalViewDelegate {
        let session: SSHSession
        weak var terminalView: TerminalView?

        init(session: SSHSession) {
            self.session = session
        }

        func send(source: TerminalView, data: ArraySlice<UInt8>) {
            let bytes = Data(data)
            Task { @MainActor in await session.send(bytes) }
        }

        func scrolled(source: TerminalView, position: Double) {}

        func setTerminalTitle(source: TerminalView, title: String) {}

        func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
            Task { @MainActor in
                try? await session.resize(cols: UInt16(newCols), rows: UInt16(newRows))
            }
        }

        func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

        func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
            guard let url = URL(string: link) else { return }
            NSWorkspace.shared.open(url)
        }

        func bell(source: TerminalView) {}

        func clipboardCopy(source: TerminalView, content: Data) {
            if let s = String(data: content, encoding: .utf8) {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(s, forType: .string)
            }
        }

        func iTermContent(source: TerminalView, content: ArraySlice<UInt8>) {}

        func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}
    }
}
#endif

// MARK: - Customizable keyboard bar

struct TermKeySpec: Identifiable {
    let id = UUID()
    let label: String
    let bytes: [UInt8]
    let accent: Bool
    let mono: Bool

    init(label: String, bytes: [UInt8], accent: Bool = false, mono: Bool = false) {
        self.label = label
        self.bytes = bytes
        self.accent = accent
        self.mono = mono
    }
}

private let keyMap: [String: [UInt8]] = [
    "Tab": [0x09], "Esc": [0x1b], "^C": [0x03], "^D": [0x04],
    "^Z": [0x1a], "^L": [0x0c], "^[": [0x1b],
    "↑": [0x1b, 0x5b, 0x41], "↓": [0x1b, 0x5b, 0x42],
    "←": [0x1b, 0x5b, 0x44], "→": [0x1b, 0x5b, 0x43],
    "Home": [0x1b, 0x5b, 0x48], "End": [0x1b, 0x5b, 0x46],
    "PgUp": [0x1b, 0x5b, 0x35, 0x7e], "PgDn": [0x1b, 0x5b, 0x36, 0x7e],
    "Ins": [0x1b, 0x5b, 0x32, 0x7e], "Del": [0x1b, 0x5b, 0x33, 0x7e],
    "F1": [0x1b, 0x4f, 0x50], "F2": [0x1b, 0x4f, 0x51],
    "F3": [0x1b, 0x4f, 0x52], "F4": [0x1b, 0x4f, 0x53],
]

struct CustomKeyboardBar: View {
    let session: SSHSession
    let buttonLabels: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(buttonLabels, id: \.self) { label in
                    let bytes = keyMap[label] ?? Array(label.utf8)
                    let isAccent = label.hasPrefix("^") || label == "Esc"
                    Button {
                        Task { await session.send(Data(bytes)) }
                    } label: {
                        Text(label)
                            .font(.system(.caption, design: isAccent ? .default : .monospaced, weight: isAccent ? .semibold : .regular))
                            .foregroundStyle(isAccent ? Theme.accent : Theme.textMuted)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(isAccent ? Theme.accent.opacity(0.08) : Color.clear)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(isAccent ? Theme.accent.opacity(0.3) : Theme.strokeMid, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
        }
        .frame(height: 42)
        .background(Theme.panel)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.stroke).frame(height: 1)
        }
    }
}

private let termKeyGroups: [[TermKeySpec]] = [
    [
        TermKeySpec(label: "ESC",  bytes: [0x1b],                   accent: true,  mono: false),
        TermKeySpec(label: "Tab",  bytes: [0x09],                   accent: false, mono: false),
        TermKeySpec(label: "^C",   bytes: [0x03],                   accent: true,  mono: false),
        TermKeySpec(label: "^D",   bytes: [0x04],                   accent: false, mono: false),
        TermKeySpec(label: "^Z",   bytes: [0x1a],                   accent: false, mono: false),
        TermKeySpec(label: "^L",   bytes: [0x0c],                   accent: false, mono: false),
        TermKeySpec(label: "^A",   bytes: [0x01],                   accent: false, mono: false),
        TermKeySpec(label: "^E",   bytes: [0x05],                   accent: false, mono: false),
    ],
    [
        TermKeySpec(label: "↑",    bytes: [0x1b, 0x5b, 0x41],      accent: false, mono: false),
        TermKeySpec(label: "↓",    bytes: [0x1b, 0x5b, 0x42],      accent: false, mono: false),
        TermKeySpec(label: "←",    bytes: [0x1b, 0x5b, 0x44],      accent: false, mono: false),
        TermKeySpec(label: "→",    bytes: [0x1b, 0x5b, 0x43],      accent: false, mono: false),
        TermKeySpec(label: "Home", bytes: [0x1b, 0x5b, 0x48],      accent: false, mono: false),
        TermKeySpec(label: "End",  bytes: [0x1b, 0x5b, 0x46],      accent: false, mono: false),
        TermKeySpec(label: "PgUp", bytes: [0x1b, 0x5b, 0x35, 0x7e], accent: false, mono: false),
        TermKeySpec(label: "PgDn", bytes: [0x1b, 0x5b, 0x36, 0x7e], accent: false, mono: false),
    ],
    [
        TermKeySpec(label: "|",  bytes: [0x7c], accent: false, mono: true),
        TermKeySpec(label: "/",  bytes: [0x2f], accent: false, mono: true),
        TermKeySpec(label: "~",  bytes: [0x7e], accent: false, mono: true),
        TermKeySpec(label: "-",  bytes: [0x2d], accent: false, mono: true),
        TermKeySpec(label: "_",  bytes: [0x5f], accent: false, mono: true),
        TermKeySpec(label: "`",  bytes: [0x60], accent: false, mono: true),
        TermKeySpec(label: "\\", bytes: [0x5c], accent: false, mono: true),
        TermKeySpec(label: "!",  bytes: [0x21], accent: false, mono: true),
        TermKeySpec(label: "$",  bytes: [0x24], accent: false, mono: true),
    ],
]

struct TerminalKeyboardBar: View {
    let session: SSHSession

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(termKeyGroups.indices, id: \.self) { gi in
                    HStack(spacing: 4) {
                        ForEach(termKeyGroups[gi].indices, id: \.self) { ki in
                            let key = termKeyGroups[gi][ki]
                            Button {
                                Task { await session.send(Data(key.bytes)) }
                            } label: {
                                Text(key.label)
                                    .font(
                                        key.mono
                                            ? .system(.caption, design: .monospaced, weight: .regular)
                                            : .system(.caption, design: .default, weight: key.accent ? .semibold : .regular)
                                    )
                                    .foregroundStyle(key.accent ? Theme.accent : Theme.textMuted)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(key.accent ? Theme.accent.opacity(0.08) : Color.clear)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .stroke(
                                                key.accent ? Theme.accent.opacity(0.3) : Theme.strokeMid,
                                                lineWidth: 1
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if gi < termKeyGroups.count - 1 {
                        Rectangle()
                            .fill(Theme.stroke)
                            .frame(width: 1, height: 16)
                            .padding(.horizontal, 8)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
        }
        .frame(height: 42)
        .background(Theme.panel)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.stroke).frame(height: 1)
        }
    }
}

// MARK: - Session view

extension Notification.Name {
    static let broadcastInput = Notification.Name("novossh.broadcastInput")
}

struct TerminalSessionView: View {
    @EnvironmentObject private var store: AppStore
    let host: Host
    @Environment(\.dismiss) private var dismiss
    @StateObject private var session = SSHSession()
    @State private var paletteOverride: TerminalPalette? = nil
    @State private var showSnippetSheet = false
    @State private var showBroadcast = false
    @State private var broadcastText = ""
    @State private var inputText = ""
    @State private var fontSize: CGFloat = 13
    @State private var sessionStartTime = Date()
    @State private var commandCount = 0

    private let keyboardLabels: [String] = {
        UserDefaults.standard.string(forKey: "novossh.keyboardButtons")?
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) } ?? []
    }()

    var body: some View {
        let palette = paletteOverride ?? TerminalPalette.byId(store.settings.themeId)
        VStack(spacing: 0) {
            // Connection bar
            HStack(spacing: 10) {
                statusDot
                Text("\(host.username)@\(host.address):\(host.port)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Menu {
                    Button {
                        showSnippetSheet = true
                    } label: { Label("Paste snippet…", systemImage: "chevron.left.forwardslash.chevron.right") }
                    Button {
                        showBroadcast.toggle()
                    } label: { Label(showBroadcast ? "Hide Broadcast" : "Broadcast Input", systemImage: "dot.radiowaves.left.and.right") }

                    Picker("Theme", selection: Binding(
                        get: { palette.id },
                        set: { paletteOverride = TerminalPalette.byId($0) }
                    )) {
                        ForEach(TerminalPalette.all, id: \.id) { p in
                            Text(p.name).tag(p.id)
                        }
                    }

                    if session.status == .connected {
                        Button(role: .destructive) {
                            saveSessionLog()
                            Task { await session.disconnect() }
                        } label: { Label("Disconnect", systemImage: "wifi.slash") }
                    } else {
                        Button {
                            Task {
                                let key = store.key(by: host.keyId)
                                let mode = host.connectionMode ?? .direct
                                var h = host; h.password = store.resolvedPassword(for: host)
                                await session.connect(host: h, identityKey: key, connectionMode: mode)
                                if case .connected = session.status {
                                    store.touchHost(host.id)
                                }
                            }
                        } label: { Label("Reconnect", systemImage: "arrow.clockwise") }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .imageScale(.large)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.panel)

            // Terminal with pinch-to-zoom
            TerminalScreen(session: session,
                           palette: palette,
                           fontSize: Int(fontSize))
                .gesture(
                    MagnifyGesture()
                        .onChanged { scale in
                            let clamped = CGFloat(store.settings.fontSize) * scale.magnification
                            fontSize = min(max(clamped, 8), 48)
                        }
                        .onEnded { scale in
                            fontSize = min(max(fontSize, 8), 48)
                        }
                )

            // Keyboard bar (customizable)
            if case .connected = session.status {
                if showBroadcast {
                    BroadcastInputBar(text: $broadcastText) { text in
                        guard !text.isEmpty else { return }
                        NotificationCenter.default.post(name: .broadcastInput, object: text)
                        Task { await session.send(Data((text + "\n").utf8)) }
                        broadcastText = ""
                    }
                }
                CustomKeyboardBar(session: session, buttonLabels: keyboardLabels)

                // Text input bar (send-on-enter)
                if store.settings.sendOnEnter {
                    HStack(spacing: 8) {
                        ZStack(alignment: .leading) {
                            // TextField's placeholder always renders in the system's default
                            // secondary color and ignores .foregroundStyle — on Mac Catalyst,
                            // where OS-level appearance is independent of our forced
                            // .preferredColorScheme(.dark), that made "$ " nearly invisible
                            // against the dark input bar. A custom placeholder Text fixes it.
                            if inputText.isEmpty {
                                Text("$ ")
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundStyle(.white.opacity(0.5))
                            }
                            TextField("", text: $inputText)
                                .textFieldStyle(.plain)
                                .font(.system(.body, design: .monospaced))
                                .foregroundStyle(.white)
                                .onSubmit { sendInput() }
                                .submitLabel(.send)
                        }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)

                        Button {
                            sendInput()
                        } label: {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title2)
                                .foregroundStyle(Theme.accent)
                        }
                        .disabled(inputText.isEmpty)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.panel)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Theme.stroke).frame(height: 1)
                    }
                }
            }
        }
        .background(Color(hex: palette.backgroundHex).ignoresSafeArea())
        .navigationTitle(host.label)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Done") {
                    saveSessionLog()
                    dismiss()
                }
            }
        }
        .sheet(isPresented: $showSnippetSheet) {
            SnippetPickerSheet { snippet in
                Task {
                    var bytes = Data(snippet.command.utf8)
                    bytes.append(0x0d)
                    await session.send(bytes)
                }
                showSnippetSheet = false
            }
            .environmentObject(store)
            #if os(iOS)
            .presentationDetents([.medium, .large])
            #endif
        }
        .task {
            sessionStartTime = Date()
            let key = store.key(by: host.keyId)
            let mode = host.connectionMode ?? .direct
            var h = host; h.password = store.resolvedPassword(for: host)
            await session.connect(host: h, identityKey: key, connectionMode: mode)
            if case .connected = session.status {
                store.touchHost(host.id)
            }
        }
        .onDisappear {
            saveSessionLog()
            Task { await session.disconnect() }
        }
    }

    private func sendInput() {
        let text = inputText
        inputText = ""
        Task { await session.send(Data((text + "\n").utf8)) }
    }

    private func saveSessionLog() {
        guard commandCount > 0 || !inputText.isEmpty else { return }
        let log = SessionLog(
            hostId: host.id,
            hostLabel: host.label,
            startedAt: sessionStartTime,
            endedAt: Date(),
            commandCount: commandCount
        )
        store.addSessionLog(log)
        commandCount = 0
    }

    @ViewBuilder
    private var statusDot: some View {
        let (color, text): (SwiftUI.Color, String) = {
            switch session.status {
            case .idle: return (.gray, "Idle")
            case .connecting: return (.yellow, "Connecting…")
            case .connected: return (.green, "Connected")
            case .disconnected: return (.gray, "Disconnected")
            case .failed(let m): return (Theme.danger, m)
            }
        }()
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text).font(.caption2).foregroundStyle(.white.opacity(0.7))
        }
    }
}
