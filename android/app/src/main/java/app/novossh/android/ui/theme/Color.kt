package app.novossh.android.ui.theme

import androidx.compose.ui.graphics.Color

// Brand — neon cyan, matches web #00e5ff
val Neon     = Color(0xFF00E5FF)
val NeonDim  = Color(0xFF00B8CC)
val NeonGlow = Color(0x1400E5FF)

// Ink surfaces — matches web Tailwind ink-* palette
val Ink950 = Color(0xFF06080C)
val Ink900 = Color(0xFF0A0E14)
val Ink850 = Color(0xFF0E1319)
val Ink800 = Color(0xFF121820)
val Ink750 = Color(0xFF171E28)
val Ink700 = Color(0xFF1C2430)
val Ink650 = Color(0xFF222C3A)
val Ink600 = Color(0xFF2A3545)
val Ink500 = Color(0xFF3A4758)

// Slate text hierarchy
val Slate100 = Color(0xFFF1F5F9)
val Slate200 = Color(0xFFE2E8F0)
val Slate300 = Color(0xFFCBD5E1)
val Slate400 = Color(0xFF94A3B8)
val Slate500 = Color(0xFF64748B)
val Slate600 = Color(0xFF475569)

// Semantic
val TerminalGreen = Color(0xFF00FF88)
val TerminalAmber = Color(0xFFFFB800)
val TerminalRed   = Color(0xFFFF3B3B)

// Terminal color schemes
data class TerminalColorScheme(
    val id: String,
    val name: String,
    val background: Int,
    val foreground: Int,
    val black: Int, val red: Int, val green: Int, val yellow: Int,
    val blue: Int, val magenta: Int, val cyan: Int, val white: Int,
    val brightBlack: Int, val brightRed: Int, val brightGreen: Int, val brightYellow: Int,
    val brightBlue: Int, val brightMagenta: Int, val brightCyan: Int, val brightWhite: Int,
)

val TERMINAL_SCHEMES = listOf(
    TerminalColorScheme(
        id = "novo-dark", name = "NovoSSH Dark",
        background = 0xFF06080C.toInt(), foreground = 0xFFE2E8F0.toInt(),
        black = 0xFF424242.toInt(), red = 0xFFCD3131.toInt(), green = 0xFF0BC161.toInt(), yellow = 0xFFC7C427.toInt(),
        blue = 0xFF0225CD.toInt(), magenta = 0xFFC930C7.toInt(), cyan = 0xFF00C5C7.toInt(), white = 0xFFC7C7C7.toInt(),
        brightBlack = 0xFF686868.toInt(), brightRed = 0xFFCD3131.toInt(), brightGreen = 0xFF0BC161.toInt(), brightYellow = 0xFFC7C427.toInt(),
        brightBlue = 0xFF0225CD.toInt(), brightMagenta = 0xFFC930C7.toInt(), brightCyan = 0xFF00C5C7.toInt(), brightWhite = 0xFFFFFFFF.toInt(),
    ),
    TerminalColorScheme(
        id = "dracula", name = "Dracula",
        background = 0xFF282A36.toInt(), foreground = 0xFFF8F8F2.toInt(),
        black = 0xFF21222C.toInt(), red = 0xFFFF5555.toInt(), green = 0xFF50FA7B.toInt(), yellow = 0xFFF1FA8C.toInt(),
        blue = 0xFFBD93F9.toInt(), magenta = 0xFFFF79C6.toInt(), cyan = 0xFF8BE9FD.toInt(), white = 0xFFF8F8F2.toInt(),
        brightBlack = 0xFF6272A4.toInt(), brightRed = 0xFFFF6E6E.toInt(), brightGreen = 0xFF69FF94.toInt(), brightYellow = 0xFFFFFFA5.toInt(),
        brightBlue = 0xFFD6ACFF.toInt(), brightMagenta = 0xFFFF92DF.toInt(), brightCyan = 0xFFA4FFFF.toInt(), brightWhite = 0xFFFFFFFF.toInt(),
    ),
    TerminalColorScheme(
        id = "one-dark", name = "One Dark",
        background = 0xFF282C34.toInt(), foreground = 0xFFABB2BF.toInt(),
        black = 0xFF282C34.toInt(), red = 0xFFE06C75.toInt(), green = 0xFF98C379.toInt(), yellow = 0xFFE5C07B.toInt(),
        blue = 0xFF61AFEF.toInt(), magenta = 0xFFC678DD.toInt(), cyan = 0xFF56B6C2.toInt(), white = 0xFFABB2BF.toInt(),
        brightBlack = 0xFF5C6370.toInt(), brightRed = 0xFFE06C75.toInt(), brightGreen = 0xFF98C379.toInt(), brightYellow = 0xFFE5C07B.toInt(),
        brightBlue = 0xFF61AFEF.toInt(), brightMagenta = 0xFFC678DD.toInt(), brightCyan = 0xFF56B6C2.toInt(), brightWhite = 0xFFFFFFFF.toInt(),
    ),
    TerminalColorScheme(
        id = "solarized-dark", name = "Solarized Dark",
        background = 0xFF002B36.toInt(), foreground = 0xFF839496.toInt(),
        black = 0xFF073642.toInt(), red = 0xFFDC322F.toInt(), green = 0xFF859900.toInt(), yellow = 0xFFB58900.toInt(),
        blue = 0xFF268BD2.toInt(), magenta = 0xFFD33682.toInt(), cyan = 0xFF2AA198.toInt(), white = 0xFFEEE8D5.toInt(),
        brightBlack = 0xFF586E75.toInt(), brightRed = 0xFFCB4B16.toInt(), brightGreen = 0xFF586E75.toInt(), brightYellow = 0xFF657B83.toInt(),
        brightBlue = 0xFF839496.toInt(), brightMagenta = 0xFF6C71C4.toInt(), brightCyan = 0xFF93A1A1.toInt(), brightWhite = 0xFFFDF6E3.toInt(),
    ),
)
