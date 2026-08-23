package app.novossh.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.P2PChatMessage
import app.novossh.android.viewmodel.P2PMessage
import app.novossh.android.viewmodel.P2PState
import app.novossh.android.viewmodel.P2PViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun P2PScreen(viewModel: P2PViewModel, navController: NavController) {
    val pendingMessages by viewModel.pendingMessages.collectAsState()
    val connectionState by viewModel.connectionState.collectAsState()
    val connectedPeer by viewModel.connectedPeer.collectAsState()
    val isPolling by viewModel.isPolling.collectAsState()
    val error by viewModel.error.collectAsState()
    val chatMessages by viewModel.chatMessages.collectAsState()
    var showConnectSheet by remember { mutableStateOf(false) }

    val incomingOffers = pendingMessages.filter { it.type == "offer" }

    LaunchedEffect(Unit) { viewModel.startPolling() }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("P2P Sessions", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        if (isPolling) viewModel.stopPolling() else viewModel.startPolling()
                    }) {
                        Icon(
                            if (isPolling) Icons.Default.WifiTethering else Icons.Default.WifiTetheringOff,
                            null,
                            tint = if (isPolling) Neon else Slate500,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Connection status / connected card
            item {
                if (connectionState == P2PState.CONNECTED && connectedPeer != null) {
                    ConnectedCard(peerId = connectedPeer!!, onDisconnect = { viewModel.disconnect() })
                } else {
                    StatusCard(state = connectionState)
                }
            }

            if (connectionState == P2PState.CONNECTED) {
                item {
                    MessagingCard(
                        messages = chatMessages,
                        onSend = { text -> viewModel.sendChatMessage(text) },
                    )
                }
            }

            // Incoming offers
            if (incomingOffers.isNotEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Notifications, null, tint = Neon, modifier = Modifier.size(16.dp))
                        Text("Incoming Requests (${incomingOffers.size})", color = Neon, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                items(incomingOffers, key = { it.id }) { msg ->
                    IncomingOfferCard(
                        message = msg,
                        onAccept = { viewModel.acceptOffer(msg) },
                        onDecline = { viewModel.declineOffer(msg.id) },
                    )
                }
            }

            // Connect button
            if (connectionState == P2PState.IDLE || connectionState == P2PState.FAILED) {
                item {
                    Button(
                        onClick = { showConnectSheet = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Icon(Icons.Default.PersonAdd, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Connect to Peer", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Info card
            item { P2PInfoCard() }
        }
    }

    // ── Sheets and dialogs ─────────────────────────────────────────────────────

    error?.let { msg ->
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            containerColor = Ink800,
            title = { Text("Error", color = Slate100) },
            text = { Text(msg, color = Slate400) },
            confirmButton = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Neon) } },
        )
    }

    if (showConnectSheet) {
        ConnectSheet(
            onDismiss = { showConnectSheet = false },
            onConnect = { peerId, sessionName ->
                viewModel.sendOffer(peerId, sessionName)
                showConnectSheet = false
            },
        )
    }
}

// ── Composables ───────────────────────────────────────────────────────────────

@Composable
private fun ConnectedCard(peerId: String, onDisconnect: () -> Unit) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF22c55e).copy(alpha = 0.08f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF22c55e).copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(10.dp)) {
                    Surface(shape = RoundedCornerShape(50), color = Color(0xFF22c55e), modifier = Modifier.fillMaxSize()) {}
                }
                Text("Connected", color = Color(0xFF22c55e), fontWeight = FontWeight.SemiBold)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.Person, null, tint = Slate400, modifier = Modifier.size(28.dp))
                Column(Modifier.weight(1f)) {
                    Text("Peer ID", color = Slate500, fontSize = 10.sp)
                    Text(peerId, color = Slate100, fontSize = 12.sp, fontFamily = FontFamily.Monospace, maxLines = 1)
                }
                TextButton(onClick = onDisconnect, colors = ButtonDefaults.textButtonColors(contentColor = TerminalRed)) {
                    Text("Disconnect")
                }
            }
        }
    }
}

@Composable
private fun MessagingCard(messages: List<P2PChatMessage>, onSend: (String) -> Unit) {
    var input by remember { mutableStateOf("") }
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Default.Bolt, null, tint = Slate500, modifier = Modifier.size(14.dp))
                Text("Data Channel", color = Slate500, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Column(
                Modifier.fillMaxWidth().heightIn(max = 140.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (messages.isEmpty()) {
                    Text(
                        "Data channel open — send a message to test the live connection.",
                        color = Slate600, fontSize = 11.sp,
                    )
                }
                messages.forEach { msg ->
                    Text(
                        "${if (msg.fromSelf) "You" else "Peer"}: ${msg.text}",
                        color = if (msg.fromSelf) Neon else Slate100,
                        fontSize = 12.sp,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input, onValueChange = { input = it },
                    placeholder = { Text("Type a message…", color = Slate600) },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Slate100, unfocusedTextColor = Slate100,
                        focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
                    ),
                )
                Button(
                    onClick = { if (input.isNotEmpty()) { onSend(input); input = "" } },
                    colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    shape = RoundedCornerShape(8.dp),
                ) { Text("Send") }
            }
        }
    }
}

@Composable
private fun StatusCard(state: P2PState) {
    val (icon, label, color) = when (state) {
        P2PState.IDLE -> Triple(Icons.Default.WifiOff, "Not connected", Slate500)
        P2PState.OFFERING -> Triple(Icons.Default.Upload, "Sending offer…", Color(0xFFf97316))
        P2PState.WAITING -> Triple(Icons.Default.HourglassTop, "Waiting for peer to accept…", Color(0xFFf97316))
        P2PState.CONNECTED -> Triple(Icons.Default.CheckCircle, "Connected", Color(0xFF22c55e))
        P2PState.FAILED -> Triple(Icons.Default.ErrorOutline, "Connection failed", TerminalRed)
    }
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(24.dp))
            Text(label, color = color, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            if (state == P2PState.OFFERING || state == P2PState.WAITING) {
                CircularProgressIndicator(color = color, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            }
        }
    }
}

@Composable
private fun IncomingOfferCard(message: P2PMessage, onAccept: () -> Unit, onDecline: () -> Unit) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        border = androidx.compose.foundation.BorderStroke(1.dp, Neon.copy(alpha = 0.2f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.PersonAdd, null, tint = Neon, modifier = Modifier.size(18.dp))
                Text("Incoming P2P Request", color = Slate100, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            }
            Text("From: ${message.from}", color = Slate400, fontSize = 12.sp, maxLines = 1)
            message.sessionName?.takeIf { it.isNotEmpty() }?.let {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Terminal, null, tint = Neon, modifier = Modifier.size(14.dp))
                    Text(it, color = Neon, fontSize = 12.sp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onAccept,
                    colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    shape = RoundedCornerShape(8.dp),
                ) { Text("Accept", fontWeight = FontWeight.SemiBold) }
                OutlinedButton(
                    onClick = onDecline,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TerminalRed),
                    border = androidx.compose.foundation.BorderStroke(1.dp, TerminalRed.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(8.dp),
                ) { Text("Decline") }
            }
        }
    }
}

@Composable
private fun P2PInfoCard() {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Default.Info, null, tint = Slate500, modifier = Modifier.size(18.dp))
            Text(
                "P2P sessions use WebRTC signaling to establish direct encrypted connections between NovoSSH clients. Enter the User ID of another user to initiate a connection.",
                color = Slate500, fontSize = 12.sp,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConnectSheet(onDismiss: () -> Unit, onConnect: (String, String) -> Unit) {
    var peerId by remember { mutableStateOf("") }
    var sessionName by remember { mutableStateOf("Shared Terminal") }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = Slate100, unfocusedTextColor = Slate100,
        focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
        focusedLabelColor = Neon, unfocusedLabelColor = Slate500,
    )
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Ink800) {
        Column(
            Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Connect to Peer", color = Slate100, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = peerId, onValueChange = { peerId = it },
                label = { Text("Peer User ID") },
                placeholder = { Text("user-id or email", color = Slate600) },
                singleLine = true, modifier = Modifier.fillMaxWidth(), colors = fieldColors,
            )
            OutlinedTextField(
                value = sessionName, onValueChange = { sessionName = it },
                label = { Text("Session Name") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), colors = fieldColors,
            )
            Button(
                onClick = { onConnect(peerId, sessionName) },
                enabled = peerId.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Send Connection Request", fontWeight = FontWeight.SemiBold) }
            Spacer(Modifier.height(8.dp))
        }
    }
}
