import SwiftUI

enum Theme {
    // Surfaces — match web ink palette
    static let bg          = Color(red: 0.024, green: 0.031, blue: 0.047)  // #06080c ink-950
    static let panel       = Color(red: 0.055, green: 0.075, blue: 0.098)  // #0e1319 ink-850
    static let panelHigh   = Color(red: 0.071, green: 0.094, blue: 0.125)  // #121820 ink-800
    static let panelMid    = Color(red: 0.090, green: 0.118, blue: 0.157)  // #171e28 ink-750
    static let stroke      = Color.white.opacity(0.04)
    static let strokeMid   = Color.white.opacity(0.08)

    // Brand — neon cyan, matches web #00e5ff
    static let accent      = Color(red: 0.000, green: 0.898, blue: 1.000)  // #00e5ff neon
    static let accentDim   = Color(red: 0.000, green: 0.722, blue: 0.800)  // #00b8cc neon-600
    static let accentGlow  = Color(red: 0.000, green: 0.898, blue: 1.000).opacity(0.08)

    // Semantic
    static let danger      = Color(red: 1.000, green: 0.231, blue: 0.231)  // #ff3b3b
    static let success     = Color(red: 0.000, green: 1.000, blue: 0.533)  // #00ff88
    static let warning     = Color(red: 1.000, green: 0.722, blue: 0.000)  // #ffb800

    // Text hierarchy
    static let textStrong  = Color(red: 0.886, green: 0.910, blue: 0.941)  // #e2e8f0
    static let textPrimary = Color(red: 0.784, green: 0.839, blue: 0.898)  // #c8d6e5
    static let textMuted   = Color(red: 0.541, green: 0.608, blue: 0.690)  // #8a9bb0
    static let textFaint   = Color(red: 0.353, green: 0.416, blue: 0.490)  // #5a6a7d

    static let avatarPalette: [Color] = [
        Color(red: 1.000, green: 0.231, blue: 0.231),
        Color(red: 1.000, green: 0.722, blue: 0.000),
        Color(red: 0.000, green: 1.000, blue: 0.533),
        Color(red: 0.000, green: 0.898, blue: 1.000),
        Color(red: 0.545, green: 0.361, blue: 0.965),
        Color(red: 0.925, green: 0.282, blue: 0.600),
        Color(red: 0.976, green: 0.451, blue: 0.086),
        Color(red: 0.133, green: 0.773, blue: 0.369),
    ]

    static func avatarColor(for seed: String) -> Color {
        var hash = 0
        for scalar in seed.unicodeScalars { hash = hash &* 31 &+ Int(scalar.value) }
        return avatarPalette[abs(hash) % avatarPalette.count]
    }
}

extension View {
    func panelStyle(radius: CGFloat = 14) -> some View {
        self
            .background(Theme.panel)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.stroke, lineWidth: 1)
            )
    }

    func cardGlowStyle(radius: CGFloat = 14) -> some View {
        self
            .background(Theme.panelHigh)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.accent.opacity(0.2), lineWidth: 1)
            )
            .shadow(color: Theme.accent.opacity(0.06), radius: 8, x: 0, y: 0)
    }
}
