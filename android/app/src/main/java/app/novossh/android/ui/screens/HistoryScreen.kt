package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun HistoryScreen(viewModel: AppViewModel) {
    val hosts by viewModel.hosts.collectAsState()
    val recent = remember(hosts) {
        hosts.filter { it.lastConnectedAt != null }.sortedByDescending { it.lastConnectedAt }
    }

    Column(Modifier.fillMaxSize().background(Ink950)) {
        if (recent.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.History, null, Modifier.size(64.dp), tint = Slate600)
                    Spacer(Modifier.height(16.dp))
                    Text("No history yet", style = MaterialTheme.typography.titleMedium, color = Slate400)
                    Text("Connect to a host to see history", color = Slate500, fontSize = 13.sp)
                }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(recent, key = { it.id }) { host ->
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Ink800),
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(host.label, fontWeight = FontWeight.SemiBold, color = Slate100)
                                Text(
                                    "${host.username}@${host.address}:${host.port}",
                                    fontSize = 13.sp, color = Slate400, fontFamily = FontFamily.Monospace,
                                )
                                host.lastConnectedAt?.let {
                                    Text(
                                        SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(it)),
                                        fontSize = 11.sp, color = Slate500,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
