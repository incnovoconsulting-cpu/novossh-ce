package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppNotification
import app.novossh.android.viewmodel.NotificationViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationViewModel,
    onBack: () -> Unit,
) {
    val notifications by viewModel.notifications.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Notifications", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    TextButton(onClick = { viewModel.fetch() }) {
                        Text("Refresh", color = Neon, fontSize = 13.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (isLoading && notifications.isEmpty()) {
                CircularProgressIndicator(color = Neon, modifier = Modifier.align(Alignment.Center))
            } else if (notifications.isEmpty()) {
                Column(
                    Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Default.NotificationsNone, null, Modifier.size(48.dp), tint = Slate600)
                    Text("No notifications", color = Slate500, fontSize = 15.sp)
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    items(notifications, key = { it.id }) { note ->
                        NotificationRow(
                            note = note,
                            onTap = { if (!note.isRead) viewModel.markRead(note.id) },
                            onDismiss = { viewModel.delete(note.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(
    note: AppNotification,
    onTap: () -> Unit,
    onDismiss: () -> Unit,
) {
    var dismissed by remember { mutableStateOf(false) }
    if (dismissed) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(if (note.isRead) Ink700 else Neon)
                .padding(top = 6.dp),
        )

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                note.title,
                color = Slate100,
                fontSize = 14.sp,
                fontWeight = if (note.isRead) FontWeight.Normal else FontWeight.SemiBold,
            )
            Text(note.message, color = Slate400, fontSize = 12.sp, maxLines = 2)
        }

        TextButton(
            onClick = { dismissed = true; onDismiss() },
            contentPadding = PaddingValues(0.dp),
        ) {
            Text("✕", color = Slate600, fontSize = 12.sp)
        }
    }

    HorizontalDivider(color = Ink800, thickness = 0.5.dp)
}
