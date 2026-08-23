package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.models.AuthMethod
import app.novossh.android.models.Host
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostsScreen(viewModel: AppViewModel, navController: NavController) {
    val hosts by viewModel.hosts.collectAsState()
    val keys by viewModel.keys.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingHost by remember { mutableStateOf<Host?>(null) }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
        ) {

            if (hosts.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Computer, null,
                            Modifier.size(64.dp),
                            tint = Slate600,
                        )
                        Spacer(Modifier.height(16.dp))
                        Text("No hosts yet", style = MaterialTheme.typography.titleMedium, color = Slate400)
                        Text("Tap + to add your first SSH host", color = Slate500, fontSize = 13.sp)
                    }
                }
            } else {
                val grouped = hosts.groupBy { it.group.ifEmpty { null } }
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f)
                ) {
                    grouped.forEach { (groupName, groupHosts) ->
                        if (groupName != null) {
                            item(key = "group_$groupName") {
                                Text(
                                    groupName,
                                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
                                    fontWeight = FontWeight.SemiBold,
                                    color = Neon,
                                    fontSize = 12.sp,
                                )
                            }
                        }
                        items(groupHosts, key = { it.id }) { host ->
                            HostListItem(
                                host = host,
                                onClick = {
                                    viewModel.touchHost(host.id)
                                    navController.navigate("terminal/${host.id}")
                                },
                                onEdit = { editingHost = host },
                                onDelete = { viewModel.deleteHost(host.id) },
                            )
                        }
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = { showAddDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 120.dp),
            containerColor = Neon,
            contentColor = Ink950,
        ) {
            Icon(Icons.Default.Add, "Add host")
        }
    }

    if (showAddDialog) {
        HostFormDialog(
            host = null,
            availableKeys = keys,
            onDismiss = { showAddDialog = false },
            onSave = { host, password ->
                viewModel.addHost(host, password)
                showAddDialog = false
            }
        )
    }

    editingHost?.let { host ->
        HostFormDialog(
            host = host,
            availableKeys = keys,
            onDismiss = { editingHost = null },
            onSave = { updated, password ->
                viewModel.updateHost(updated, password)
                editingHost = null
            }
        )
    }
}

@Composable
private fun HostListItem(
    host: Host,
    onClick: () -> Unit,
    onEdit: () -> Unit,
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
            val dotColor = host.colorHex?.let {
                try { Color(android.graphics.Color.parseColor(it)) } catch (_: Exception) { null }
            } ?: Neon
            Box(
                Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(host.label, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Slate100)
                Text(
                    "${host.username}@${host.address}:${host.port}",
                    fontSize = 13.sp,
                    color = Slate400,
                    fontFamily = FontFamily.Monospace,
                )
                if (host.lastConnectedAt != null) {
                    val sdf = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
                    Text(
                        sdf.format(Date(host.lastConnectedAt)),
                        fontSize = 11.sp,
                        color = Slate500,
                    )
                }
            }
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, "More", tint = Slate400)
                }
                DropdownMenu(menuExpanded, { menuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text("Edit") },
                        onClick = { menuExpanded = false; onEdit() },
                        leadingIcon = { Icon(Icons.Default.Edit, null, tint = Slate400) },
                    )
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HostFormDialog(
    host: Host?,
    availableKeys: List<app.novossh.android.models.IdentityKey>,
    onDismiss: () -> Unit,
    onSave: (Host, String?) -> Unit,
) {
    var label by remember { mutableStateOf(host?.label ?: "") }
    var address by remember { mutableStateOf(host?.address ?: "") }
    var port by remember { mutableStateOf(host?.port?.toString() ?: "22") }
    var username by remember { mutableStateOf(host?.username ?: "") }
    var authMethod by remember { mutableStateOf(host?.authMethod ?: AuthMethod.PASSWORD) }
    var password by remember { mutableStateOf("") }
    var selectedKeyId by remember { mutableStateOf(host?.keyId) }
    var labelError by remember { mutableStateOf<String?>(null) }
    var addressError by remember { mutableStateOf<String?>(null) }
    var usernameError by remember { mutableStateOf<String?>(null) }
    var tmuxAutoAttach by remember { mutableStateOf(host?.tmuxAutoAttach ?: false) }
    var group by remember { mutableStateOf(host?.group ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text(if (host == null) "Add host" else "Edit host", color = Slate100) },
        text = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = label, onValueChange = { label = it; labelError = null },
                    label = { Text("Label", color = Slate400) },
                    isError = labelError != null,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                labelError?.let { Text(it, color = TerminalRed, fontSize = 10.sp) }
                OutlinedTextField(
                    value = address, onValueChange = { address = it; addressError = null },
                    label = { Text("Address", color = Slate400) },
                    isError = addressError != null,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                addressError?.let { Text(it, color = TerminalRed, fontSize = 10.sp) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = port, onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 5) port = it },
                        label = { Text("Port", color = Slate400) },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                    )
                    OutlinedTextField(
                        value = username, onValueChange = { username = it; usernameError = null },
                        label = { Text("Username", color = Slate400) },
                        isError = usernameError != null,
                        modifier = Modifier.weight(2f),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                    )
                }
                usernameError?.let { Text(it, color = TerminalRed, fontSize = 10.sp) }
                OutlinedTextField(
                    value = group, onValueChange = { group = it },
                    label = { Text("Group (optional)", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AuthMethod.values().forEach { method ->
                        FilterChip(
                            selected = authMethod == method,
                            onClick = { authMethod = method },
                            label = { Text(method.name.lowercase().replaceFirstChar { it.uppercase() }) },
                        )
                    }
                }
                when (authMethod) {
                    AuthMethod.PASSWORD -> OutlinedTextField(
                        value = password, onValueChange = { password = it },
                        label = { Text("Password", color = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                    )
                    AuthMethod.KEY -> {
                        if (availableKeys.isEmpty()) {
                            Text("No SSH keys saved. Add keys in the Keys tab.", color = Slate500, fontSize = 13.sp)
                        } else {
                            availableKeys.forEach { key ->
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedKeyId = key.id }
                                        .padding(4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    RadioButton(selected = selectedKeyId == key.id, onClick = { selectedKeyId = key.id }, colors = RadioButtonDefaults.colors(selectedColor = Neon))
                                    Text(key.label, color = Slate200)
                                }
                            }
                        }
                    }
                    AuthMethod.AGENT -> Text("SSH agent forwarding will be used.", color = Slate500, fontSize = 13.sp)
                    AuthMethod.CERT -> {
                        Text("Certificate + private key authentication", color = Slate500, fontSize = 13.sp)
                        Text("Select a private key and paste your OpenSSH certificate below.", color = Slate500, fontSize = 11.sp)
                        if (availableKeys.isNotEmpty()) {
                            availableKeys.forEach { key ->
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedKeyId = key.id }
                                        .padding(4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    RadioButton(selected = selectedKeyId == key.id, onClick = { selectedKeyId = key.id }, colors = RadioButtonDefaults.colors(selectedColor = Neon))
                                    Text(key.label, color = Slate200)
                                }
                            }
                        } else {
                            Text("No SSH keys saved. Add keys in the Keys tab.", color = Slate500, fontSize = 13.sp)
                        }
                    }
                }
                // tmux auto-attach toggle
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("tmux auto-attach", color = Slate200, fontSize = 14.sp)
                        Text("Attach to existing tmux session", fontSize = 12.sp, color = Slate500)
                    }
                    Switch(
                        checked = tmuxAutoAttach,
                        onCheckedChange = { tmuxAutoAttach = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = Neon),
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    var valid = true
                    if (label.isBlank()) { labelError = "Label is required"; valid = false }
                    if (address.isBlank()) { addressError = "Address is required"; valid = false }
                    if (username.isBlank()) { usernameError = "Username is required"; valid = false }
                    if (!valid) return@Button
                    app.novossh.android.debug.DebugLog.i("HostForm", "Saving host: $label @ $address:$port")
                    val newHost = (host ?: Host(label = "", address = "", username = "")).copy(
                        label = label, address = address, port = port.toIntOrNull() ?: 22,
                        username = username, authMethod = authMethod,
                        keyId = if (authMethod == AuthMethod.KEY || authMethod == AuthMethod.CERT) selectedKeyId else null,
                        tmuxAutoAttach = tmuxAutoAttach,
                        group = group,
                        updatedAt = System.currentTimeMillis(),
                    )
                    val pw = if (authMethod == AuthMethod.PASSWORD && password.isNotBlank()) password else null
                    app.novossh.android.debug.DebugLog.d("HostForm", "Host saved: id=${newHost.id} pw=${pw != null}")
                    onSave(newHost, pw)
                },
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } }
    )
}
