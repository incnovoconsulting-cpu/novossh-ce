package app.novossh.android.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AnalyticsViewModel
import app.novossh.android.viewmodel.HeatmapCell
import app.novossh.android.viewmodel.TopCommand

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsDashboardScreen(
    viewModel: AnalyticsViewModel,
    navController: NavController,
) {
    val sessionMetrics by viewModel.sessionMetrics.collectAsState()
    val topCommands by viewModel.topCommands.collectAsState()
    val heatmap by viewModel.heatmap.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var selectedDays by remember { mutableIntStateOf(30) }
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.fetchAll(selectedDays) }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Analytics", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val csv = buildString {
                            appendLine("Metric,Value")
                            sessionMetrics?.let { m ->
                                appendLine("Total Sessions,${m.totalSessions}")
                                appendLine("Avg Duration (min),${"%.1f".format(m.avgDuration)}")
                                appendLine("Total Commands,${m.totalCommands}")
                            }
                            if (topCommands.isNotEmpty()) {
                                appendLine("")
                                appendLine("Command,Count")
                                topCommands.forEach { cmd ->
                                    appendLine("${cmd.command},${cmd.count}")
                                }
                            }
                        }
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("analytics-csv", csv))
                        Toast.makeText(context, "Analytics CSV copied to clipboard", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(Icons.Default.ContentCopy, "Export CSV", tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Time range selector
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(7, 14, 30, 90).forEach { days ->
                        FilterChip(
                            selected = selectedDays == days,
                            onClick = { selectedDays = days; viewModel.fetchAll(days) },
                            label = { Text("${days}d", fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Neon.copy(alpha = 0.15f),
                                selectedLabelColor = Neon,
                                containerColor = Ink800,
                                labelColor = Slate400,
                            ),
                        )
                    }
                }
            }

            if (isLoading && sessionMetrics == null) {
                item {
                    Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Neon)
                    }
                }
            } else {
                // Stats cards
                sessionMetrics?.let { m ->
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            StatCard("Sessions", "${m.totalSessions}", m.trendSessions, Modifier.weight(1f))
                            StatCard("Commands", "${m.totalCommands}", m.trendCommands, Modifier.weight(1f))
                            StatCard("Avg Duration", formatDur(m.avgDuration), null, Modifier.weight(1f))
                        }
                    }
                }

                // Top commands
                if (topCommands.isNotEmpty()) {
                    item { CommandsSection(topCommands) }
                }

                // Heatmap
                if (heatmap.isNotEmpty()) {
                    item { HeatmapSection(heatmap) }
                }
            }
        }
    }
}

@Composable
private fun StatCard(title: String, value: String, trend: Int?, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, color = Slate500, fontSize = 10.sp, modifier = Modifier.weight(1f))
                trend?.let {
                    Icon(
                        if (it >= 0) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown,
                        null, Modifier.size(12.dp),
                        tint = if (it >= 0) Color(0xFF22c55e) else Color(0xFFef4444),
                    )
                }
            }
            Text(value, color = Slate100, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CommandsSection(commands: List<TopCommand>) {
    val maxCount = commands.maxOfOrNull { it.count } ?: 1
    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Top Commands", color = Slate100, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            commands.take(8).forEach { cmd ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            cmd.command,
                            color = Neon,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 1,
                            modifier = Modifier.weight(1f),
                        )
                        Text("${cmd.count}", color = Slate500, fontSize = 11.sp)
                    }
                    BoxWithConstraints(Modifier.fillMaxWidth()) {
                        val fraction = cmd.count.toFloat() / maxCount
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Ink700)
                        )
                        Box(
                            Modifier
                                .width(maxWidth * fraction)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Neon.copy(alpha = 0.6f))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HeatmapSection(cells: List<HeatmapCell>) {
    val maxValue = cells.maxOfOrNull { it.value } ?: 1
    val days = listOf("S", "M", "T", "W", "T", "F", "S")

    fun cellValue(hour: Int, day: Int) = cells.firstOrNull { it.hour == hour && it.day == day }?.value ?: 0

    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Activity Heatmap", color = Slate100, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text("Hour of day  (0–23)", color = Slate600, fontSize = 10.sp)

            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val cellSize = (maxWidth - 24.dp) / 24
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    for (d in 0..6) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(days[d], color = Slate600, fontSize = 9.sp, modifier = Modifier.width(12.dp))
                            for (h in 0..23) {
                                val v = cellValue(h, d)
                                val alpha = if (v > 0) 0.12f + (v.toFloat() / maxValue) * 0.88f else 0.05f
                                Box(
                                    Modifier
                                        .size(cellSize)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(Neon.copy(alpha = alpha))
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatDur(ms: Double): String {
    val s = (ms / 1000).toInt()
    return if (s < 60) "${s}s" else "${s / 60}m"
}
