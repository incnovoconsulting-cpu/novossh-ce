package app.novossh.android.ui.screens

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.models.Host
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel

@Composable
fun SFTPBrowserScreen(viewModel: AppViewModel, navController: NavController) {
    val hosts by viewModel.hosts.collectAsState()

    Column(Modifier.fillMaxSize()) {
        if (hosts.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Folder, null, Modifier.size(64.dp), tint = Slate600)
                    Spacer(Modifier.height(16.dp))
                    Text("No hosts available", style = MaterialTheme.typography.titleMedium, color = Slate400)
                    Text("Add a host first to use SFTP", color = Slate500, fontSize = 13.sp)
                }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(hosts, key = { it.id }) { host ->
                    Card(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clickable { navController.navigate("sftp/${host.id}") },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Ink800),
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Folder, null, Modifier.size(32.dp), tint = Neon)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(host.label, fontWeight = FontWeight.SemiBold, color = Slate100)
                                Text(
                                    "${host.username}@${host.address}:${host.port}",
                                    fontSize = 13.sp, color = Slate400, fontFamily = FontFamily.Monospace,
                                )
                            }
                            Icon(Icons.Default.ChevronRight, null, tint = Slate500)
                        }
                    }
                }
            }
        }
    }
}
