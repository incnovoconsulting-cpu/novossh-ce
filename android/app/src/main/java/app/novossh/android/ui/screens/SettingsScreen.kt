package app.novossh.android.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.*
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.BuildConfig
import app.novossh.android.ui.theme.*
import app.novossh.android.ui.theme.TERMINAL_SCHEMES
import app.novossh.android.viewmodel.AppViewModel
import app.novossh.android.viewmodel.AuthViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val AVAILABLE_FONTS = listOf("Monospace", "Sans Serif", "Serif", "Default")
private val AVAILABLE_KEYS = listOf(
    "Tab", "Esc", "^C", "^D", "^Z", "^L", "^[",
    "↑", "↓", "←", "→", "Home", "End", "PgUp", "PgDn",
    "Ins", "Del", "F1", "F2", "F3", "F4",
    "|", "/", "~", "-", "_", ":", ".",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: AppViewModel, authViewModel: AuthViewModel, currentPlan: String = "free", onOpenDebug: () -> Unit = {}) {
    val settings by viewModel.settings.collectAsState()
    val authState by authViewModel.authState.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val lastSyncTime by viewModel.lastSyncTime.collectAsState()
    val syncError by viewModel.syncError.collectAsState()
    val context = LocalContext.current
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showFontDialog by remember { mutableStateOf(false) }
    var showSchemeDialog by remember { mutableStateOf(false) }
    var showKeyboardDialog by remember { mutableStateOf(false) }
    val selectedKeys = remember(settings.keyboardButtons) {
        settings.keyboardButtons.split(",").map { it.trim() }.toSet()
    }

    if (showFontDialog) {
        FontPickerDialog(
            currentFont = settings.fontFamily,
            onSelect = { viewModel.updateSettings(settings.copy(fontFamily = it)); showFontDialog = false },
            onDismiss = { showFontDialog = false },
        )
    }

    if (showSchemeDialog) {
        TerminalSchemePickerDialog(
            currentScheme = settings.terminalScheme,
            onSelect = { viewModel.updateSettings(settings.copy(terminalScheme = it)); showSchemeDialog = false },
            onDismiss = { showSchemeDialog = false },
        )
    }

    if (showKeyboardDialog) {
        KeyboardConfigDialog(
            selectedKeys = selectedKeys,
            onSave = { keys -> viewModel.updateSettings(settings.copy(keyboardButtons = keys.joinToString(","))); showKeyboardDialog = false },
            onDismiss = { showKeyboardDialog = false },
        )
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Ink950)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Account
        Text("Account", style = MaterialTheme.typography.labelLarge, color = Neon)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Ink800),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(authState.email ?: "Not signed in", color = Slate100, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(4.dp))
                Text(
                    "${currentPlan.replaceFirstChar(Char::uppercase)} Plan",
                    color = Neon, fontSize = 12.sp, fontFamily = FontFamily.Monospace,
                )
            }
        }

        HorizontalDivider(color = Ink700)

        // Terminal
        Text("Terminal", style = MaterialTheme.typography.labelLarge, color = Neon)

        // Font size
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Font size: ${settings.fontSize}sp", color = Slate200)
            Slider(
                value = settings.fontSize.toFloat(),
                onValueChange = { viewModel.updateSettings(settings.copy(fontSize = it.toInt())) },
                valueRange = 8f..28f,
                steps = 19,
                modifier = Modifier.width(180.dp),
                colors = SliderDefaults.colors(thumbColor = Neon, activeTrackColor = Neon),
            )
        }

        // Font family
        Row(
            Modifier.fillMaxWidth().clickable { showFontDialog = true },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Font family", color = Slate200)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(settings.fontFamily, color = Neon, fontSize = 13.sp)
                Icon(Icons.Default.ChevronRight, null, Modifier.size(16.dp), tint = Slate500)
            }
        }

        // Terminal color scheme
        Row(
            Modifier.fillMaxWidth().clickable { showSchemeDialog = true },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Color scheme", color = Slate200)
            Row(verticalAlignment = Alignment.CenterVertically) {
                val schemeName = TERMINAL_SCHEMES.find { it.id == settings.terminalScheme }?.name ?: "NovoSSH Dark"
                Text(schemeName, color = Neon, fontSize = 13.sp)
                Icon(Icons.Default.ChevronRight, null, Modifier.size(16.dp), tint = Slate500)
            }
        }

        // Copy on select
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Copy on select", color = Slate200)
                Text("Auto-copy selected text to clipboard", fontSize = 12.sp, color = Slate500)
            }
            Switch(
                settings.copyOnSelect,
                { viewModel.updateSettings(settings.copy(copyOnSelect = it)) },
                colors = SwitchDefaults.colors(checkedTrackColor = Neon),
            )
        }

        // Cursor blink
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Cursor blink", color = Slate200)
            Switch(
                settings.cursorBlink,
                { viewModel.updateSettings(settings.copy(cursorBlink = it)) },
                colors = SwitchDefaults.colors(checkedTrackColor = Neon),
            )
        }

        // Bell sound
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Bell sound", color = Slate200)
            Switch(
                settings.bellSound,
                { viewModel.updateSettings(settings.copy(bellSound = it)) },
                colors = SwitchDefaults.colors(checkedTrackColor = Neon),
            )
        }

        // Send on Enter
        Row(
            Modifier.fillMaxWidth().clickable { showFontDialog = false },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Send on Enter", color = Slate200)
                Text("Keyboard enter sends command", fontSize = 12.sp, color = Slate500)
            }
            Switch(
                settings.sendOnEnter,
                { viewModel.updateSettings(settings.copy(sendOnEnter = it)) },
                colors = SwitchDefaults.colors(checkedTrackColor = Neon),
            )
        }

        // Scrollback
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Scrollback: ${settings.scrollback} lines", color = Slate200)
            Slider(
                value = settings.scrollback.toFloat(),
                onValueChange = { viewModel.updateSettings(settings.copy(scrollback = it.toInt())) },
                valueRange = 1000f..50000f,
                steps = 48,
                modifier = Modifier.width(180.dp),
                colors = SliderDefaults.colors(thumbColor = Neon, activeTrackColor = Neon),
            )
        }

        HorizontalDivider(color = Ink700)

        // Keyboard
        Text("Keyboard Add-on", style = MaterialTheme.typography.labelLarge, color = Neon)
        Row(
            Modifier.fillMaxWidth().clickable { showKeyboardDialog = true },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Customize keys", color = Slate200)
                Text("${selectedKeys.size} keys visible", fontSize = 12.sp, color = Slate500)
            }
            Icon(Icons.Default.ChevronRight, null, Modifier.size(16.dp), tint = Slate500)
        }

        HorizontalDivider(color = Ink700)

        // Connection
        Text("Connection", style = MaterialTheme.typography.labelLarge, color = Neon)
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Keep alive: ${settings.keepAliveSeconds}s", color = Slate200)
            Slider(
                value = settings.keepAliveSeconds.toFloat(),
                onValueChange = { viewModel.updateSettings(settings.copy(keepAliveSeconds = it.toInt())) },
                valueRange = 0f..300f,
                steps = 29,
                modifier = Modifier.width(180.dp),
                colors = SliderDefaults.colors(thumbColor = Neon, activeTrackColor = Neon),
            )
        }

        HorizontalDivider(color = Ink700)

        // Security
        Text("Security", style = MaterialTheme.typography.labelLarge, color = Neon)
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Biometric Lock", color = Slate200)
                Text("Require fingerprint to open app", fontSize = 12.sp, color = Slate500)
            }
            Switch(
                settings.biometricLock,
                { viewModel.updateSettings(settings.copy(biometricLock = it)) },
                colors = SwitchDefaults.colors(checkedTrackColor = Neon),
            )
        }

        HorizontalDivider(color = Ink700)

        // Cloud Sync
        Text("Cloud Sync", style = MaterialTheme.typography.labelLarge, color = Neon)

        if (authState.isAuthenticated) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    if (lastSyncTime != null) {
                        val fmt = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())
                        Text("Last synced: ${fmt.format(Date(lastSyncTime!!))}", color = Slate400, fontSize = 12.sp)
                    } else {
                        Text("Not synced yet", color = Slate500, fontSize = 12.sp)
                    }
                    if (syncError != null) {
                        Text(syncError!!, color = TerminalRed, fontSize = 11.sp)
                    }
                }
                Button(
                    onClick = { viewModel.syncNow() },
                    enabled = !isSyncing,
                    colors = ButtonDefaults.buttonColors(containerColor = Neon.copy(alpha = 0.15f), contentColor = Neon),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    if (isSyncing) {
                        CircularProgressIndicator(Modifier.size(14.dp), color = Neon, strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(if (isSyncing) "Syncing…" else "Sync Now", fontSize = 13.sp)
                }
            }
        } else {
            Text("Sign in to enable sync", color = Slate500, fontSize = 12.sp)
        }

        HorizontalDivider(color = Ink700)

        // Support
        Text("Support", style = MaterialTheme.typography.labelLarge, color = Neon)
        TextButton(
            onClick = {
                val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@novossh.com"))
                context.startActivity(intent)
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Default.Email, null, Modifier.size(16.dp), tint = Neon.copy(alpha = 0.7f))
            Spacer(Modifier.width(8.dp))
            Text("Email Support", color = Neon.copy(alpha = 0.7f), fontSize = 13.sp)
            Spacer(Modifier.weight(1f))
        }

        HorizontalDivider(color = Ink700)

        // About
        Text("About", style = MaterialTheme.typography.labelLarge, color = Neon)
        Text("NovoSSH Terminal v${BuildConfig.VERSION_NAME}", color = Slate400, fontSize = 13.sp)
        Text("Secure SSH terminal client for Android", color = Slate500, fontSize = 12.sp)

        if (BuildConfig.DEBUG) {
            TextButton(onClick = onOpenDebug, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.BugReport, null, Modifier.size(16.dp), tint = Slate500)
                Spacer(Modifier.width(8.dp))
                Text("Debug Log", color = Slate500, fontSize = 12.sp)
            }
        }

        HorizontalDivider(color = Ink700)

        // Logout
        Button(
            onClick = { showLogoutDialog = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = TerminalRed.copy(alpha = 0.15f), contentColor = TerminalRed),
            shape = RoundedCornerShape(10.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.Logout, null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Sign Out")
        }

        Spacer(Modifier.height(16.dp))
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            containerColor = Ink800,
            title = { Text("Sign Out", color = Slate100) },
            text = { Text("Are you sure you want to sign out?", color = Slate300) },
            confirmButton = {
                Button(
                    onClick = { showLogoutDialog = false; authViewModel.logout() },
                    colors = ButtonDefaults.buttonColors(containerColor = TerminalRed, contentColor = Slate100),
                ) { Text("Sign Out") }
            },
            dismissButton = { TextButton(onClick = { showLogoutDialog = false }) { Text("Cancel", color = Slate400) } },
        )
    }
}

@Composable
private fun FontPickerDialog(currentFont: String, onSelect: (String) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Terminal Font", color = Slate100) },
        text = {
            Column {
                AVAILABLE_FONTS.forEach { font ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(font) }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = font == currentFont,
                            onClick = { onSelect(font) },
                            colors = RadioButtonDefaults.colors(selectedColor = Neon),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            font,
                            color = if (font == currentFont) Neon else Slate200,
                            fontFamily = when (font) {
                                "Monospace" -> FontFamily.Monospace
                                "Serif" -> FontFamily.Serif
                                "Sans Serif" -> FontFamily.SansSerif
                                else -> FontFamily.Default
                            },
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Done", color = Neon) } },
    )
}

@Composable
private fun TerminalSchemePickerDialog(currentScheme: String, onSelect: (String) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Terminal Color Scheme", color = Slate100) },
        text = {
            Column {
                TERMINAL_SCHEMES.forEach { scheme ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(scheme.id) }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = scheme.id == currentScheme,
                            onClick = { onSelect(scheme.id) },
                            colors = RadioButtonDefaults.colors(selectedColor = Neon),
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(scheme.name, color = if (scheme.id == currentScheme) Neon else Slate200)
                            // Color swatch preview
                            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                listOf(scheme.red, scheme.green, scheme.blue, scheme.yellow, scheme.magenta, scheme.cyan).forEach { c ->
                                    Box(Modifier.size(12.dp).background(Color(c), RoundedCornerShape(2.dp)))
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Done", color = Neon) } },
    )
}

@Composable
private fun KeyboardConfigDialog(selectedKeys: Set<String>, onSave: (Set<String>) -> Unit, onDismiss: () -> Unit) {
    var selected by remember { mutableStateOf(selectedKeys) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Keyboard Keys", color = Slate100) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Select keys to show in the terminal toolbar:", color = Slate400, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                AVAILABLE_KEYS.forEach { key ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                selected = if (key in selected) selected - key else selected + key
                            }
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = key in selected,
                            onCheckedChange = { checked ->
                                selected = if (checked) selected + key else selected - key
                            },
                            colors = CheckboxDefaults.colors(checkedColor = Neon),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(key, color = Slate200, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(selected) },
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}
