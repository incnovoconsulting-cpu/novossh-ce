import SwiftUI

struct TerminalPalette: Codable, Hashable {
    let id: String
    let name: String
    let backgroundHex: String
    let foregroundHex: String
    let cursorHex: String
    let ansiHex: [String]   // 16 colors

    static let novoDark = TerminalPalette(
        id: "novo-dark", name: "NovoSSH Dark",
        backgroundHex: "#0b0f14", foregroundHex: "#d6deeb", cursorHex: "#60a5fa",
        ansiHex: [
            "#011627", "#ef4444", "#22c55e", "#eab308",
            "#60a5fa", "#c792ea", "#7fdbca", "#d6deeb",
            "#637777", "#ff5874", "#22d3ee", "#ffeb95",
            "#82aaff", "#ae81ff", "#7fdbca", "#ffffff",
        ]
    )

    static let dracula = TerminalPalette(
        id: "dracula", name: "Dracula",
        backgroundHex: "#282a36", foregroundHex: "#f8f8f2", cursorHex: "#f8f8f0",
        ansiHex: [
            "#21222c", "#ff5555", "#50fa7b", "#f1fa8c",
            "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
            "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5",
            "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
        ]
    )

    static let oneDark = TerminalPalette(
        id: "one-dark", name: "One Dark",
        backgroundHex: "#1e2127", foregroundHex: "#abb2bf", cursorHex: "#528bff",
        ansiHex: [
            "#1e2127", "#e06c75", "#98c379", "#d19a66",
            "#61afef", "#c678dd", "#56b6c2", "#abb2bf",
            "#5c6370", "#e06c75", "#98c379", "#d19a66",
            "#61afef", "#c678dd", "#56b6c2", "#ffffff",
        ]
    )

    static let solarizedDark = TerminalPalette(
        id: "solarized-dark", name: "Solarized Dark",
        backgroundHex: "#002b36", foregroundHex: "#839496", cursorHex: "#93a1a1",
        ansiHex: [
            "#073642", "#dc322f", "#859900", "#b58900",
            "#268bd2", "#d33682", "#2aa198", "#eee8d5",
            "#586e75", "#cb4b16", "#586e75", "#657b83",
            "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
        ]
    )

    static let all: [TerminalPalette] = [.novoDark, .dracula, .oneDark, .solarizedDark]

    static func byId(_ id: String) -> TerminalPalette {
        all.first { $0.id == id } ?? .novoDark
    }
}

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        var int: UInt64 = 0
        Scanner(string: s).scanHexInt64(&int)
        let r, g, b, a: UInt64
        switch s.count {
        case 6: (r, g, b, a) = ((int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff, 255)
        case 8: (r, g, b, a) = ((int >> 24) & 0xff, (int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff)
        default: (r, g, b, a) = (255, 255, 255, 255)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}
