package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.models.Host
import app.novossh.android.models.PortForwarding
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortForwardingScreen(
    host: Host,
    portForwards: List<PortForwarding>,
    onAddForward: (PortForwarding) -> Unit,
    onUpdateForward: (PortForwarding) -> Unit,
    onDeleteForward: (PortForwarding) -> Unit,
    onBack: () -> Unit,
) {
    var showAddSheet by remember { mutableStateOf(false) }
    var editingForward by remember { mutableStateOf<PortForwarding?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Port Forwarding") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.Edit, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showAddSheet = true }) {
                        Icon(Icons.Default.Add, "Add")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (portForwards.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("No port forwards", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Add a port forward to tunnel traffic through this SSH connection.",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp)
                ) {
                    items(portForwards) { forward ->
                        PortForwardCard(
                            forward = forward,
                            onEdit = { editingForward = forward },
                            onDelete = { onDeleteForward(forward) }
                        )
                    }
                }
            }
        }
    }

    if (showAddSheet) {
        AddPortForwardDialog(
            hostId = host.id,
            onDismiss = { showAddSheet = false },
            onAdd = { forward ->
                onAddForward(forward)
                showAddSheet = false
            }
        )
    }

    if (editingForward != null) {
        EditPortForwardDialog(
            forward = editingForward!!,
            onDismiss = { editingForward = null },
            onUpdate = { updated ->
                onUpdateForward(updated)
                editingForward = null
            }
        )
    }
}

@Composable
fun PortForwardCard(
    forward: PortForwarding,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(forward.label, style = MaterialTheme.typography.headlineSmall)
                    Text(
                        forward.type,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusBadge(status = forward.status)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    "Local: ${forward.localPort}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "Remote: ${forward.remoteHost}:${forward.remotePort}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onEdit,
                    modifier = Modifier
                        .weight(1f)
                        .height(36.dp)
                ) {
                    Icon(Icons.Default.Edit, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Edit")
                }

                Button(
                    onClick = onDelete,
                    modifier = Modifier
                        .weight(1f)
                        .height(36.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Icon(Icons.Default.Delete, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Delete")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val (color, label) = when (status) {
        "ACTIVE" -> Color.Green to "Active"
        "CONNECTING" -> Color.Yellow to "Connecting"
        "FAILED" -> Color.Red to "Failed"
        else -> Color.Gray to "Inactive"
    }

    Surface(
        color = color.copy(alpha = 0.2f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

@Composable
fun AddPortForwardDialog(
    hostId: String,
    onDismiss: () -> Unit,
    onAdd: (PortForwarding) -> Unit,
) {
    var label by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("LOCAL") }
    var localPort by remember { mutableStateOf("8000") }
    var remoteHost by remember { mutableStateOf("") }
    var remotePort by remember { mutableStateOf("22") }

    val isValid = label.isNotEmpty() && remoteHost.isNotEmpty() &&
        localPort.toIntOrNull()?.let { it > 0 } == true &&
        remotePort.toIntOrNull()?.let { it > 0 } == true

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Port Forward") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = label,
                    onValueChange = { label = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth()
                )

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Type", style = MaterialTheme.typography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("LOCAL", "REMOTE", "SOCKS5").forEach { t ->
                            FilterChip(
                                selected = type == t,
                                onClick = { type = t },
                                label = { Text(t) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = localPort,
                    onValueChange = { localPort = it },
                    label = { Text("Local Port") },
                    modifier = Modifier.fillMaxWidth()
                )

                if (type != "SOCKS5") {
                    OutlinedTextField(
                        value = remoteHost,
                        onValueChange = { remoteHost = it },
                        label = { Text("Remote Host") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = remotePort,
                        onValueChange = { remotePort = it },
                        label = { Text("Remote Port") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val forward = PortForwarding(
                        hostId = hostId,
                        label = label,
                        type = type,
                        localPort = localPort.toInt(),
                        remoteHost = if (type == "SOCKS5") "127.0.0.1" else remoteHost,
                        remotePort = if (type == "SOCKS5") 0 else remotePort.toInt()
                    )
                    onAdd(forward)
                },
                enabled = isValid
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun EditPortForwardDialog(
    forward: PortForwarding,
    onDismiss: () -> Unit,
    onUpdate: (PortForwarding) -> Unit,
) {
    var label by remember { mutableStateOf(forward.label) }
    var type by remember { mutableStateOf(forward.type) }
    var localPort by remember { mutableStateOf(forward.localPort.toString()) }
    var remoteHost by remember { mutableStateOf(forward.remoteHost) }
    var remotePort by remember { mutableStateOf(forward.remotePort.toString()) }

    val isValid = label.isNotEmpty() && remoteHost.isNotEmpty() &&
        localPort.toIntOrNull()?.let { it > 0 } == true &&
        remotePort.toIntOrNull()?.let { it > 0 } == true

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Port Forward") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = label,
                    onValueChange = { label = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth()
                )

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Type", style = MaterialTheme.typography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("LOCAL", "REMOTE", "SOCKS5").forEach { t ->
                            FilterChip(
                                selected = type == t,
                                onClick = { type = t },
                                label = { Text(t) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = localPort,
                    onValueChange = { localPort = it },
                    label = { Text("Local Port") },
                    modifier = Modifier.fillMaxWidth()
                )

                if (type != "SOCKS5") {
                    OutlinedTextField(
                        value = remoteHost,
                        onValueChange = { remoteHost = it },
                        label = { Text("Remote Host") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = remotePort,
                        onValueChange = { remotePort = it },
                        label = { Text("Remote Port") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val updated = forward.copy(
                        label = label,
                        type = type,
                        localPort = localPort.toInt(),
                        remoteHost = if (type == "SOCKS5") "127.0.0.1" else remoteHost,
                        remotePort = if (type == "SOCKS5") 0 else remotePort.toInt()
                    )
                    onUpdate(updated)
                },
                enabled = isValid
            ) {
                Text("Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortForwardingListScreen(viewModel: AppViewModel, navController: androidx.navigation.NavController) {
    val hosts by viewModel.hosts.collectAsState()
    var selectedHost by remember { mutableStateOf<Host?>(null) }

    if (selectedHost != null) {
        val host = selectedHost!!
        PortForwardingScreen(
            host = host,
            portForwards = emptyList(),
            onAddForward = {},
            onUpdateForward = {},
            onDeleteForward = {},
            onBack = { selectedHost = null },
        )
        return
    }

    Box(Modifier.fillMaxSize()) {
        if (hosts.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.Default.SwapHoriz, null, Modifier.size(64.dp), tint = Slate600)
                Spacer(Modifier.height(16.dp))
                Text("No hosts available", style = MaterialTheme.typography.titleMedium, color = Slate400)
                Text("Add a host first to configure port forwarding", color = Slate500, fontSize = 13.sp)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(hosts, key = { it.id }) { host ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clickable { selectedHost = host },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Ink800),
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.SwapHoriz, null, Modifier.size(24.dp), tint = Neon)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(host.label, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Slate100)
                                Text("${host.address}:${host.port}", fontSize = 13.sp, color = Slate400, fontFamily = FontFamily.Monospace)
                            }
                            Icon(Icons.Default.ChevronRight, null, tint = Slate500)
                        }
                    }
                }
            }
        }
    }
}
