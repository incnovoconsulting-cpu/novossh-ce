package app.novossh.android.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.debug.DebugLog
import app.novossh.android.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DebugLogScreen(onBack: () -> Unit) {
    val entries = remember { mutableStateListOf<app.novossh.android.debug.LogEntry>() }
    var autoRefresh by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val listState = rememberLazyListState()
    val sdf = remember { SimpleDateFormat("HH:mm:ss.SSS", Locale.US) }

    LaunchedEffect(autoRefresh) {
        while (autoRefresh) {
            entries.clear()
            entries.addAll(DebugLog.getEntries())
            kotlinx.coroutines.delay(500)
        }
    }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Debug log", fontFamily = FontFamily.Monospace) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val text = DebugLog.export()
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("debug log", text))
                        Toast.makeText(context, "Log copied to clipboard", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(Icons.Default.Share, "Copy log")
                    }
                    IconButton(onClick = { DebugLog.clear(); entries.clear() }) {
                        Icon(Icons.Default.Delete, "Clear")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Ink950)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${entries.size} entries",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = Slate500,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Auto-refresh", fontSize = 11.sp, color = Slate500)
                    Switch(
                        checked = autoRefresh,
                        onCheckedChange = { autoRefresh = it },
                        colors = SwitchDefaults.colors(checkedTrackColor = Neon),
                    )
                }
            }

            if (entries.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("No log entries yet.\nEnable debug mode and perform an action.", color = Slate500, fontSize = 13.sp)
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    items(entries.reversed()) { entry ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    when (entry.level) {
                                        "E" -> TerminalRed.copy(alpha = 0.08f)
                                        "W" -> TerminalAmber.copy(alpha = 0.08f)
                                        else -> Ink800
                                },
                                RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    sdf.format(Date(entry.timestamp)),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Slate500,
                                )
                                Text(
                                    entry.level,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = when (entry.level) {
                                        "E" -> TerminalRed
                                        "W" -> TerminalAmber
                                        "I" -> Neon
                                        else -> Slate400
                                    },
                                )
                            }
                            Text(
                                "[${entry.tag}] ${entry.message}",
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Slate200,
                            )
                            if (entry.details != null) {
                                Text(
                                    entry.details,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Slate500,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
