package app.novossh.android.ui.components

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.models.Host
import app.novossh.android.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommandPaletteSheet(
    hosts: List<Host>,
    onDismiss: () -> Unit,
    onConnectHost: (Host) -> Unit,
    onOpenSFTP: () -> Unit,
    onOpenPortForwarding: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query, hosts) {
        if (query.isBlank()) hosts
        else hosts.filter {
            it.label.contains(query, ignoreCase = true) ||
            it.address.contains(query, ignoreCase = true)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Ink900,
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        dragHandle = null,
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search hosts or commands…", color = Slate500, fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = Slate500) },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Default.Close, null, tint = Slate500)
                        }
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Slate100,
                    unfocusedTextColor = Slate100,
                    focusedBorderColor = Neon,
                    unfocusedBorderColor = Ink600,
                    cursorColor = Neon,
                ),
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
            )
        }

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            if (filtered.isNotEmpty()) {
                item {
                    Text("HOSTS", color = Slate500, fontSize = 10.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 6.dp))
                }
                items(filtered, key = { it.id }) { host ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onDismiss(); onConnectHost(host) }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .let { m ->
                                    val hex = host.colorHex?.removePrefix("#")
                                    val color = if (hex != null && hex.length == 6) {
                                        runCatching { Color(("FF$hex").toLong(16)) }.getOrElse { Neon }
                                    } else Neon
                                    m.then(Modifier)
                                }
                        )
                        Column(Modifier.weight(1f)) {
                            Text(host.label, color = Slate100, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text(
                                "${host.username}@${host.address}:${host.port}",
                                color = Slate500, fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                            )
                        }
                        Icon(Icons.Default.Terminal, null, Modifier.size(14.dp), tint = Slate600)
                    }
                }
            }

            item {
                Text("ACTIONS", color = Slate500, fontSize = 10.sp,
                    fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
            }
            item {
                ActionItem(Icons.Default.Folder, "SFTP Browser") { onDismiss(); onOpenSFTP() }
            }
            item {
                ActionItem(Icons.Default.SwapHoriz, "Port Forwarding") { onDismiss(); onOpenPortForwarding() }
            }

            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun ActionItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, null, Modifier.size(18.dp), tint = Neon)
        Text(label, color = Slate200, fontSize = 14.sp)
    }
}
