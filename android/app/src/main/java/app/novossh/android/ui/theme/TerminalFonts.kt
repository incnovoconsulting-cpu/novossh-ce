package app.novossh.android.ui.theme

import android.graphics.Typeface

enum class TerminalFont(val label: String, val typeface: Typeface, val family: String) {
    MONOSPACE("Monospace", Typeface.MONOSPACE, "monospace"),
    SERIF("Serif", Typeface.SERIF, "serif"),
    SANS_SERIF("Sans Serif", Typeface.SANS_SERIF, "sans-serif"),
    DEFAULT("Default", Typeface.DEFAULT, "default"),
}

object TerminalFontProvider {
    fun getFont(fontName: String): TerminalFont {
        return TerminalFont.entries.find { it.name == fontName } ?: TerminalFont.MONOSPACE
    }
}
