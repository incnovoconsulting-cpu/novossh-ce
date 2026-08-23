package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.models.Vault
import app.novossh.android.models.VaultEntry
import app.novossh.android.ui.theme.*
import kotlinx.coroutines.flow.flowOf
import app.novossh.android.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultScreen(viewModel: AppViewModel) {
    val vaults by viewModel.vaults.collectAsState()
    var selectedVault by remember { mutableStateOf<Vault?>(null) }
    var showCreateVault by remember { mutableStateOf(false) }
    var showCreateEntry by remember { mutableStateOf(false) }
    var selectedEntry by remember { mutableStateOf<VaultEntry?>(null) }
    var showUseEntry by remember { mutableStateOf(false) }

    val entriesFlow = selectedVault?.let { viewModel.getVaultEntries(it.id) }
    val entries by (entriesFlow ?: flowOf(emptyList())).collectAsState(initial = emptyList())

    if (showCreateVault) {
        CreateVaultDialog(
            onDismiss = { showCreateVault = false },
            onCreate = { name, desc ->
                viewModel.createVault(name, desc)
                showCreateVault = false
            },
        )
    }

    if (showCreateEntry && selectedVault != null) {
        CreateVaultEntryDialog(
            vaultId = selectedVault!!.id,
            onDismiss = { showCreateEntry = false },
            onCreate = { type, name, data ->
                viewModel.createVaultEntry(selectedVault!!.id, type, name, data)
                showCreateEntry = false
            },
        )
    }

    if (showUseEntry && selectedEntry != null) {
        UseVaultEntryDialog(
            entry = selectedEntry!!,
            onDismiss = { showUseEntry = false; selectedEntry = null },
            onAddHost = { name, address ->
                viewModel.addHost(
                    app.novossh.android.models.Host(
                        label = name,
                        address = address,
                        username = "root",
                    ), null
                )
                showUseEntry = false
                selectedEntry = null
            },
            onAddKey = { name, keyData ->
                viewModel.addKey(
                    app.novossh.android.models.IdentityKey(
                        label = name,
                        privateKeyRef = "",
                    ), keyData
                )
                showUseEntry = false
                selectedEntry = null
            },
            onCopy = { /* handled by clipboard */ },
        )
    }

    Box(Modifier.fillMaxSize()) {
        if (selectedVault == null) {
            // Vault list
            Column(Modifier.fillMaxSize()) {
                if (vaults.isEmpty()) {
                    Box(Modifier.fillMaxSize().weight(1f), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Lock, null, Modifier.size(64.dp), tint = Slate600)
                            Spacer(Modifier.height(16.dp))
                            Text("No vaults yet", style = MaterialTheme.typography.titleMedium, color = Slate400)
                            Text("Create a vault to store credentials securely", color = Slate500, fontSize = 13.sp)
                        }
                    }
                } else {
                    LazyColumn(Modifier.fillMaxSize().weight(1f)) {
                        items(vaults, key = { it.id }) { vault ->
                            VaultListItem(
                                vault = vault,
                                onClick = { selectedVault = vault },
                                onDelete = { viewModel.deleteVault(vault) },
                            )
                        }
                    }
                }
            }
        } else {
            // Vault entries
            Column(Modifier.fillMaxSize()) {
                TopAppBar(
                    title = { Text(selectedVault!!.name, color = Slate100, fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = { selectedVault = null }) {
                            Icon(Icons.Default.ArrowBack, "Back", tint = Slate400)
                        }
                    },
                    actions = {
                        IconButton(onClick = { showCreateEntry = true }) {
                            Icon(Icons.Default.Add, "Add entry", tint = Neon)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
                )

                if (entries.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Lock, null, Modifier.size(48.dp), tint = Slate600)
                            Spacer(Modifier.height(12.dp))
                            Text("No entries", style = MaterialTheme.typography.titleSmall, color = Slate400)
                            Text("Tap + to add credentials", color = Slate500, fontSize = 12.sp)
                        }
                    }
                } else {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(entries, key = { it.id }) { entry ->
                            VaultEntryItem(
                                entry = entry,
                                onDelete = { viewModel.deleteVaultEntry(entry.id) },
                                onUse = {
                                    selectedEntry = entry
                                    showUseEntry = true
                                },
                            )
                        }
                    }
                }
            }
        }

        if (selectedVault == null) {
            FloatingActionButton(
                onClick = { showCreateVault = true },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 120.dp),
                containerColor = Neon,
                contentColor = Ink950,
            ) { Icon(Icons.Default.Add, "Create vault") }
        }
    }
}

@Composable
private fun VaultListItem(
    vault: Vault,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Lock, null, Modifier.size(24.dp), tint = Neon)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(vault.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Slate100)
                vault.description?.let {
                    Text(it, fontSize = 12.sp, color = Slate500, maxLines = 1)
                }
            }
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, "More", tint = Slate400)
                }
                DropdownMenu(menuExpanded, { menuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text("Delete", color = TerminalRed) },
                        onClick = { menuExpanded = false; onDelete() },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) },
                    )
                }
            }
        }
    }
}

@Composable
private fun VaultEntryItem(
    entry: VaultEntry,
    onDelete: () -> Unit,
    onUse: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onUse),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            val icon = when (entry.type) {
                "HOST" -> Icons.Default.Computer
                "CREDENTIAL" -> Icons.Default.Lock
                "KEY" -> Icons.Default.Key
                else -> Icons.Default.Description
            }
            Icon(icon, null, Modifier.size(24.dp), tint = Neon)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(entry.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Slate100)
                Text(entry.type.lowercase().replaceFirstChar { it.uppercase() }, fontSize = 12.sp, color = Slate500)
            }
            Icon(Icons.Default.ChevronRight, null, tint = Slate600, modifier = Modifier.size(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateVaultDialog(
    onDismiss: () -> Unit,
    onCreate: (name: String, description: String?) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Create Vault", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onCreate(name, description.ifBlank { null }) },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateVaultEntryDialog(
    vaultId: String,
    onDismiss: () -> Unit,
    onCreate: (type: String, name: String, data: String) -> Unit,
) {
    var type by remember { mutableStateOf("HOST") }
    var name by remember { mutableStateOf("") }
    var hostAddress by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var keyData by remember { mutableStateOf("") }
    var noteContent by remember { mutableStateOf("") }

    fun buildData(): String = when (type) {
        "HOST" -> """{"address":"$hostAddress"}"""
        "CREDENTIAL" -> """{"username":"$username","password":"$password"}"""
        "KEY" -> """{"keyData":"${keyData.replace("\"", "\\\"")}"}"""
        "NOTE" -> """{"content":"${noteContent.replace("\"", "\\\"")}"}"""
        else -> "{}"
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Add Entry", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("HOST", "CREDENTIAL", "KEY", "NOTE").forEach { t ->
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t.lowercase().replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Label", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                when (type) {
                    "HOST" -> {
                        OutlinedTextField(
                            value = hostAddress,
                            onValueChange = { hostAddress = it },
                            label = { Text("Address (IP or hostname)", color = Slate400) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                        )
                    }
                    "CREDENTIAL" -> {
                        OutlinedTextField(
                            value = username,
                            onValueChange = { username = it },
                            label = { Text("Username / Email", color = Slate400) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Password", color = Slate400) },
                            modifier = Modifier.fillMaxWidth(),
                            visualTransformation = PasswordVisualTransformation(),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                        )
                    }
                    "KEY" -> {
                        OutlinedTextField(
                            value = keyData,
                            onValueChange = { keyData = it },
                            label = { Text("Private Key (PEM)", color = Slate400) },
                            modifier = Modifier.fillMaxWidth().height(120.dp),
                            textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = Slate100),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                        )
                    }
                    "NOTE" -> {
                        OutlinedTextField(
                            value = noteContent,
                            onValueChange = { noteContent = it },
                            label = { Text("Content", color = Slate400) },
                            modifier = Modifier.fillMaxWidth().height(120.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onCreate(type, name, buildData()) },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UseVaultEntryDialog(
    entry: VaultEntry,
    onDismiss: () -> Unit,
    onAddHost: (name: String, address: String) -> Unit,
    onAddKey: (name: String, keyData: String) -> Unit,
    onCopy: (String) -> Unit,
) {
    val jsonData = try {
        org.json.JSONObject(entry.encryptedData)
    } catch (_: Exception) { null }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Use Entry", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Name: ${entry.name}", color = Slate200, fontWeight = FontWeight.SemiBold)
                Text("Type: ${entry.type.lowercase().replaceFirstChar { it.uppercase() }}", color = Slate500)

                when (entry.type) {
                    "HOST" -> {
                        val address = jsonData?.optString("address", "") ?: ""
                        Text("Address: $address", color = Slate400)
                    }
                    "CREDENTIAL" -> {
                        val username = jsonData?.optString("username", "") ?: ""
                        Text("Username: $username", color = Slate400)
                    }
                    "KEY" -> {
                        Text("Private key available", color = Slate400)
                    }
                    "NOTE" -> {
                        val content = jsonData?.optString("content", "") ?: ""
                        Text("Content: $content", color = Slate400, maxLines = 3)
                    }
                }
            }
        },
        confirmButton = {
            when (entry.type) {
                "HOST" -> {
                    val address = jsonData?.optString("address", "") ?: ""
                    Button(
                        onClick = { onAddHost(entry.name, address) },
                        colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    ) { Text("Add as Host") }
                }
                "KEY" -> {
                    val keyData = jsonData?.optString("keyData", "") ?: ""
                    Button(
                        onClick = { onAddKey(entry.name, keyData) },
                        colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    ) { Text("Add as Key") }
                }
                else -> {
                    val data = jsonData?.optString("content", jsonData?.optString("username", "")) ?: ""
                    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
                    Button(
                        onClick = {
                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(data))
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    ) { Text("Copy") }
                }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}
