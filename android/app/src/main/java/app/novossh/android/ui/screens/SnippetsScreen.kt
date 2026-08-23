package app.novossh.android.ui.screens

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
import app.novossh.android.models.Snippet
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel

private val PRE_SEEDED_SNIPPETS = listOf(
    Snippet(label = "System Overview", command = "uname -a && uptime && df -h", description = "System info, uptime, and disk usage"),
    Snippet(label = "Memory & Processes", command = "free -h && top -bn1 | head -20", description = "Memory usage and top processes"),
    Snippet(label = "Listening Ports", command = "ss -tlnp", description = "Active TCP listeners"),
    Snippet(label = "Disk Usage", command = "du -sh /* 2>/dev/null | sort -rh | head -20", description = "Largest directories"),
    Snippet(label = "Docker Containers", command = "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", description = "Running Docker containers"),
    Snippet(label = "Nginx Error Log", command = "tail -100 /var/log/nginx/error.log", description = "Recent Nginx errors"),
    Snippet(label = "SSL Certificate Check", command = "echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates", description = "Check SSL cert expiry"),
    Snippet(label = "Network Connections", command = "ss -tunap | head -30", description = "Active network connections"),
    Snippet(label = "Git Status", command = "git status && git log --oneline -5", description = "Working tree status and recent commits"),
    Snippet(label = "Systemctl Status", command = "systemctl list-units --type=service --state=running", description = "Running services"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SnippetsScreen(viewModel: AppViewModel) {
    val snippets by viewModel.snippets.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {

            if (snippets.isEmpty()) {
                Box(Modifier.fillMaxSize().weight(1f), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Code, null, Modifier.size(64.dp), tint = Slate600)
                        Spacer(Modifier.height(16.dp))
                        Text("No snippets yet", style = MaterialTheme.typography.titleMedium, color = Slate400)
                        Text("Tap + to add a command snippet", color = Slate500, fontSize = 13.sp)
                        Spacer(Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = { PRE_SEEDED_SNIPPETS.forEach { viewModel.addSnippet(it) } },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Neon),
                        ) {
                            Icon(Icons.Default.AutoAwesome, null, Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Load starter snippets")
                        }
                    }
                }
            } else {
                LazyColumn(Modifier.fillMaxSize().weight(1f)) {
                    items(snippets, key = { it.id }) { snippet ->
                        SnippetItem(snippet, onDelete = { viewModel.deleteSnippet(snippet.id) })
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = { showAdd = true },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 120.dp),
            containerColor = Neon,
            contentColor = Ink950,
        ) { Icon(Icons.Default.Add, "Add") }
    }

    if (showAdd) {
        SnippetFormDialog(
            onDismiss = { showAdd = false },
            onSave = { viewModel.addSnippet(it); showAdd = false },
        )
    }
}

@Composable
private fun SnippetItem(snippet: Snippet, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(snippet.label, fontWeight = FontWeight.SemiBold, color = Slate100)
                Text(snippet.command, fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Slate400)
                snippet.description?.let { Text(it, fontSize = 12.sp, color = Slate500) }
            }
            Box {
                IconButton({ menu = true }) { Icon(Icons.Default.MoreVert, null, tint = Slate400) }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem(
                        text = { Text("Delete", color = TerminalRed) },
                        onClick = { menu = false; onDelete() },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SnippetFormDialog(onDismiss: () -> Unit, onSave: (Snippet) -> Unit) {
    var label by remember { mutableStateOf("") }
    var command by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Add snippet", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    label, { label = it }, label = { Text("Label", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                OutlinedTextField(
                    command, { command = it }, label = { Text("Command", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, color = Slate100),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                OutlinedTextField(
                    desc, { desc = it }, label = { Text("Description (optional)", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (label.isNotBlank() && command.isNotBlank())
                        onSave(Snippet(label = label, command = command, description = desc.takeIf { it.isNotBlank() }))
                },
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } }
    )
}
