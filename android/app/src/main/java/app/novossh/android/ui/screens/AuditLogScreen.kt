package app.novossh.android.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import app.novossh.android.viewmodel.AuditEvent
import app.novossh.android.viewmodel.AuditViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuditLogScreen(
    viewModel: AuditViewModel,
    navController: NavController,
) {
    val events by viewModel.events.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val hasMore by viewModel.hasMore.collectAsState()
    var filterText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    val filtered = remember(events, filterText) {
        if (filterText.isBlank()) events
        else events.filter {
            it.action.contains(filterText, ignoreCase = true) ||
            (it.resourceType ?: "").contains(filterText, ignoreCase = true) ||
            (it.details ?: "").contains(filterText, ignoreCase = true)
        }
    }

    // Load more when near end
    val shouldLoadMore = remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible >= filtered.size - 5
        }
    }
    LaunchedEffect(shouldLoadMore.value) {
        if (shouldLoadMore.value && hasMore) viewModel.fetchMore()
    }

    LaunchedEffect(Unit) { viewModel.fetchFirst() }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Audit Log", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = filterText,
                onValueChange = { filterText = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Filter by action or resource…", color = Slate600, fontSize = 13.sp) },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Slate100, unfocusedTextColor = Slate100,
                    focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
                ),
                shape = RoundedCornerShape(8.dp),
            )

            if (isLoading && events.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Neon)
                }
            } else if (filtered.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No audit events", color = Slate500, fontSize = 15.sp)
                }
            } else {
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                    items(filtered, key = { it.id }) { event ->
                        AuditRow(event)
                        HorizontalDivider(color = Ink800, thickness = 0.5.dp)
                    }
                    if (hasMore || isLoading) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                                if (isLoading) CircularProgressIndicator(color = Neon, modifier = Modifier.size(20.dp))
                                else TextButton(onClick = { viewModel.fetchMore() }) {
                                    Text("Load more", color = Neon, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuditRow(event: AuditEvent) {
    val actionColor = when {
        event.action.contains("delete", ignoreCase = true) ||
        event.action.contains("remove", ignoreCase = true) -> Color(0xFFef4444)
        event.action.contains("create", ignoreCase = true) ||
        event.action.contains("add", ignoreCase = true) -> Color(0xFF22c55e)
        event.action.contains("login", ignoreCase = true) ||
        event.action.contains("auth", ignoreCase = true) -> Neon
        else -> Color(0xFFf97316)
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clickable { }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                event.action,
                color = actionColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier
                    .let { m ->
                        m.then(
                            Modifier
                                .padding(horizontal = 0.dp)
                        )
                    },
            )
            event.resourceType?.let {
                Text(it, color = Slate500, fontSize = 11.sp)
            }
        }

        event.details?.takeIf { it.isNotEmpty() }?.let {
            Text(it, color = Slate400, fontSize = 12.sp, maxLines = 2)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            event.ipAddress?.let {
                Text(it, color = Slate600, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
            }
            Text(event.createdAt.take(16).replace("T", " "), color = Slate600, fontSize = 10.sp)
        }
    }
}
