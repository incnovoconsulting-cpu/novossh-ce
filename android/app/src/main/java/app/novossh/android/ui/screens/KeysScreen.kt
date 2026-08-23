package app.novossh.android.ui.screens

import android.app.Activity
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.models.IdentityKey
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeysScreen(viewModel: AppViewModel) {
    val keys by viewModel.keys.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {

            if (keys.isEmpty()) {
                Box(Modifier.fillMaxSize().weight(1f), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Key, null, Modifier.size(64.dp), tint = Slate600)
                        Spacer(Modifier.height(16.dp))
                        Text("No SSH keys", style = MaterialTheme.typography.titleMedium, color = Slate400)
                        Text("Add keys for key-based auth", color = Slate500, fontSize = 13.sp)
                    }
                }
            } else {
                LazyColumn(Modifier.fillMaxSize().weight(1f)) {
                    items(keys, key = { it.id }) { key ->
                        KeyItem(key, onDelete = { viewModel.deleteKey(key.id) })
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
        KeyFormDialog(
            onDismiss = { showAdd = false },
            onSave = { key, pem -> viewModel.addKey(key, pem); showAdd = false },
        )
    }
}

@Composable
private fun KeyItem(key: IdentityKey, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Key, null, Modifier.size(32.dp), tint = Neon)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(key.label, fontWeight = FontWeight.SemiBold, color = Slate100)
                key.publicKey?.let {
                    Text(
                        it.take(40) + "...",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = Slate500,
                    )
                }
                if (key.hasPassphrase) {
                    Text("Protected with passphrase", fontSize = 11.sp, color = Slate500)
                }
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
private fun KeyFormDialog(onDismiss: () -> Unit, onSave: (IdentityKey, String) -> Unit) {
    var label by remember { mutableStateOf("") }
    var pem by remember { mutableStateOf("") }
    var hasPassphrase by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            try {
                val stream = context.contentResolver.openInputStream(it)
                pem = stream?.bufferedReader()?.use { r -> r.readText() } ?: ""
                stream?.close()
                if (pem.isBlank()) {
                    android.widget.Toast.makeText(context, "File is empty or unreadable", android.widget.Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                android.widget.Toast.makeText(context, "Failed to read file: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Add SSH key", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    label, { label = it }, label = { Text("Label", color = Slate400) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                OutlinedTextField(
                    pem, { pem = it }, label = { Text("Private Key (PEM)", color = Slate400) },
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                    textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Slate100),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon, focusedTextColor = Slate100, unfocusedTextColor = Slate200),
                )
                OutlinedButton(
                    onClick = { filePicker.launch("text/plain") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300),
                    border = ButtonDefaults.outlinedButtonBorder,
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(Icons.Default.FolderOpen, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Import from file", fontSize = 12.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(hasPassphrase, { hasPassphrase = it }, colors = CheckboxDefaults.colors(checkedColor = Neon))
                    Text("Has passphrase", color = Slate200)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (label.isNotBlank() && pem.isNotBlank()) {
                        onSave(IdentityKey(label = label, privateKeyRef = "key_placeholder", hasPassphrase = hasPassphrase), pem)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } }
    )
}
