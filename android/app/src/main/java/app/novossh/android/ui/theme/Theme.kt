package app.novossh.android.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary          = Neon,
    onPrimary        = Ink950,
    primaryContainer = NeonDim,
    onPrimaryContainer = Ink950,

    secondary        = TerminalGreen,
    onSecondary      = Ink950,
    secondaryContainer = TerminalGreen.copy(alpha = 0.12f),
    onSecondaryContainer = TerminalGreen,

    tertiary         = TerminalAmber,
    onTertiary       = Ink950,
    tertiaryContainer = TerminalAmber.copy(alpha = 0.12f),
    onTertiaryContainer = TerminalAmber,

    background       = Ink950,
    surface          = Ink850,
    surfaceVariant   = Ink800,
    surfaceTint      = Neon,

    onBackground     = Slate100,
    onSurface        = Slate100,
    onSurfaceVariant = Slate400,

    error            = TerminalRed,
    onError          = Color.White,
    errorContainer   = TerminalRed.copy(alpha = 0.12f),
    onErrorContainer = TerminalRed,

    outline          = Ink650,
    outlineVariant   = Ink700,
    scrim            = Ink950.copy(alpha = 0.8f),
)

@Composable
fun NovoSSHTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography  = Typography,
        content     = content,
    )
}
