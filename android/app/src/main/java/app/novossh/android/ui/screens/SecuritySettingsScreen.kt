package app.novossh.android.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.PasskeyCredential
import app.novossh.android.viewmodel.SecurityViewModel
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecuritySettingsScreen(viewModel: SecurityViewModel, navController: NavController) {
    val credentials by viewModel.credentials.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    var showSamlSheet by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<PasskeyCredential?>(null) }
    var renameTarget by remember { mutableStateOf<PasskeyCredential?>(null) }

    LaunchedEffect(Unit) { viewModel.fetchCredentials() }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Security", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(vertical = 12.dp),
        ) {
            // ── Passkeys section ─────────────────────────────────────────────
            item {
                SectionHeader(icon = Icons.Default.Key, title = "Passkeys & Security Keys")
            }

            if (isLoading && credentials.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Neon, modifier = Modifier.size(24.dp))
                    }
                }
            } else if (credentials.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        colors = CardDefaults.cardColors(containerColor = Ink800),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Row(
                            Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(Icons.Default.KeyOff, null, tint = Slate600, modifier = Modifier.size(20.dp))
                            Text("No passkeys registered", color = Slate500, fontSize = 14.sp)
                        }
                    }
                }
            } else {
                items(credentials, key = { it.id }) { cred ->
                    CredentialCard(
                        credential = cred,
                        onDelete = { deleteTarget = cred },
                        onRename = { renameTarget = cred },
                    )
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Ink800),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    // Android 14+ note
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(Icons.Default.Info, null, tint = Neon, modifier = Modifier.size(16.dp))
                            Text(
                                "Register passkeys from the web app",
                                color = Slate300, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                            )
                        }
                        Text(
                            "Passkey registration requires the NovoSSH web interface. Registered passkeys appear here automatically.",
                            color = Slate500, fontSize = 12.sp,
                        )
                    }
                }
            }

            item { Spacer(Modifier.height(20.dp)) }

            // ── SAML SSO section ─────────────────────────────────────────────
            item {
                SectionHeader(icon = Icons.Default.Security, title = "SAML Single Sign-On")
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Ink800),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "Connect your organization's identity provider (Okta, Azure AD, Google Workspace, etc.) for single sign-on.",
                            color = Slate400, fontSize = 13.sp,
                        )
                        Button(
                            onClick = { showSamlSheet = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Default.OpenInBrowser, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Sign In with SSO", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }

    // ── Dialogs ───────────────────────────────────────────────────────────────

    error?.let { msg ->
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            containerColor = Ink800,
            title = { Text("Error", color = Slate100) },
            text = { Text(msg, color = Slate400) },
            confirmButton = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Neon) } },
        )
    }

    deleteTarget?.let { cred ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            containerColor = Ink800,
            title = { Text("Delete passkey?", color = Slate100) },
            text = { Text("\"${cred.name ?: "Unnamed"}\" will be removed from your account.", color = Slate400) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteCredential(cred.id)
                    deleteTarget = null
                }) { Text("Delete", color = TerminalRed) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel", color = Slate400) } },
        )
    }

    renameTarget?.let { cred ->
        RenameDialog(
            current = cred.name ?: "",
            onDismiss = { renameTarget = null },
            onSave = { name ->
                viewModel.renameCredential(cred.id, name)
                renameTarget = null
            },
        )
    }

    if (showSamlSheet) {
        SamlLoginSheet(
            viewModel = viewModel,
            onDismiss = { showSamlSheet = false },
        )
    }
}

// ── Composable helpers ────────────────────────────────────────────────────────

@Composable
private fun SectionHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String) {
    Row(
        Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = Neon, modifier = Modifier.size(14.dp))
        Text(title, color = Neon, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
    }
}

@Composable
private fun CredentialCard(credential: PasskeyCredential, onDelete: () -> Unit, onRename: () -> Unit) {
    var showMenu by remember { mutableStateOf(false) }
    val transportIcon = when (credential.transports.firstOrNull()) {
        "internal" -> Icons.Default.Fingerprint
        "usb" -> Icons.Default.Usb
        "nfc" -> Icons.Default.Nfc
        else -> Icons.Default.Key
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        shape = RoundedCornerShape(10.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(transportIcon, null, tint = Neon, modifier = Modifier.size(22.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(credential.name ?: "Unnamed Passkey", color = Slate100, fontWeight = FontWeight.Medium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Added ${relativeDate(credential.created_at)}",
                        color = Slate500, fontSize = 11.sp, fontFamily = FontFamily.Monospace,
                    )
                    credential.last_used_at?.let {
                        Text("· Used ${relativeDate(it)}", color = Slate600, fontSize = 11.sp)
                    }
                }
            }
            Box {
                IconButton(onClick = { showMenu = true }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.MoreVert, null, tint = Slate600, modifier = Modifier.size(18.dp))
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Rename") },
                        leadingIcon = { Icon(Icons.Default.Edit, null, tint = Slate400) },
                        onClick = { showMenu = false; onRename() },
                    )
                    DropdownMenuItem(
                        text = { Text("Delete", color = TerminalRed) },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) },
                        onClick = { showMenu = false; onDelete() },
                    )
                }
            }
        }
    }
}

@Composable
private fun RenameDialog(current: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var name by remember { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Rename Passkey", color = Slate100) },
        text = {
            OutlinedTextField(
                value = name, onValueChange = { name = it },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Slate100, unfocusedTextColor = Slate100,
                    focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
                ),
            )
        },
        confirmButton = {
            TextButton(onClick = { onSave(name) }, enabled = name.isNotEmpty()) { Text("Save", color = Neon) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SamlLoginSheet(viewModel: SecurityViewModel, onDismiss: () -> Unit) {
    var orgId by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Ink800) {
        Column(
            Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("SAML Single Sign-On", color = Slate100, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Enter your organization ID to redirect to your identity provider.",
                color = Slate400, fontSize = 13.sp,
            )
            OutlinedTextField(
                value = orgId,
                onValueChange = { orgId = it },
                label = { Text("Organization ID") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Slate100, unfocusedTextColor = Slate100,
                    focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
                    focusedLabelColor = Neon, unfocusedLabelColor = Slate500,
                ),
            )
            Button(
                onClick = {
                    isLoading = true
                    scope.launch {
                        val url = viewModel.getSamlLoginUrl(orgId)
                        isLoading = false
                        if (url != null) {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            onDismiss()
                        }
                    }
                },
                enabled = orgId.isNotEmpty() && !isLoading,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) {
                if (isLoading) CircularProgressIndicator(color = Ink950, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Continue with SSO", fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

private fun relativeDate(iso: String): String = try {
    val dt = OffsetDateTime.parse(iso)
    val now = OffsetDateTime.now()
    val days = ChronoUnit.DAYS.between(dt, now)
    when {
        days == 0L -> "today"
        days == 1L -> "yesterday"
        days < 30 -> "${days}d ago"
        days < 365 -> "${days / 30}mo ago"
        else -> "${days / 365}yr ago"
    }
} catch (_: Exception) { iso.take(10) }
