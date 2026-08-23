package app.novossh.android.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.navigation.NavController
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.SessionPlaybackViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionPlaybackScreen(
    sessionId: String,
    viewModel: SessionPlaybackViewModel,
    navController: NavController,
) {
    val data by viewModel.playbackData.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val currentFrame by viewModel.currentFrame.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val speed by viewModel.speed.collectAsState()
    val displayText by viewModel.displayText.collectAsState()
    val scrollState = rememberScrollState()
    val context = LocalContext.current

    LaunchedEffect(sessionId) { viewModel.fetchPlayback(sessionId) }
    LaunchedEffect(displayText) { scrollState.animateScrollTo(scrollState.maxValue) }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Playback", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { viewModel.pause(); navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        data?.let { session ->
                            val exportText = buildString {
                                appendLine("#!/bin/bash")
                                appendLine("# NovoSSH Session Recording Export")
                                appendLine("# Session: ${session.sessionId}")
                                appendLine("")
                                session.frames.forEach { frame ->
                                    when (frame.type) {
                                        "command" -> {
                                            appendLine("")
                                            appendLine("# ${frame.timestamp}")
                                            frame.command?.let { appendLine(it) }
                                        }
                                        "output" -> frame.output?.let { append(it) }
                                        else -> {}
                                    }
                                }
                            }
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("session-export", exportText))
                            Toast.makeText(context, "Session exported to clipboard", Toast.LENGTH_SHORT).show()
                        }
                    }) {
                        Icon(Icons.Default.ContentCopy, "Export", tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        },
        bottomBar = {
            if (data != null) {
                PlaybackControlBar(
                    currentFrame = currentFrame,
                    totalFrames = data!!.frames.size,
                    isPlaying = isPlaying,
                    speed = speed,
                    onSeek = { viewModel.seek(it) },
                    onPlayPause = { if (isPlaying) viewModel.pause() else viewModel.play() },
                    onSetSpeed = { viewModel.setSpeed(it) },
                )
            }
        }
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .background(android.graphics.Color.parseColor("#0d1117").let {
                    androidx.compose.ui.graphics.Color(it)
                }),
        ) {
            if (isLoading && data == null) {
                Column(
                    Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(color = Neon)
                    Text("Loading playback…", color = Slate500, fontSize = 13.sp)
                }
            } else {
                Text(
                    text = displayText.ifEmpty { "Press play to start\n" },
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .horizontalScroll(rememberScrollState())
                        .padding(12.dp),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    color = androidx.compose.ui.graphics.Color(0xFFE2E8F0),
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

@Composable
private fun PlaybackControlBar(
    currentFrame: Int,
    totalFrames: Int,
    isPlaying: Boolean,
    speed: Float,
    onSeek: (Int) -> Unit,
    onPlayPause: () -> Unit,
    onSetSpeed: (Float) -> Unit,
) {
    val speeds = listOf(0.5f, 1.0f, 1.5f, 2.0f, 4.0f)
    var showSpeedMenu by remember { mutableStateOf(false) }

    Surface(color = Ink900, tonalElevation = 4.dp) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Slider(
                value = currentFrame.toFloat(),
                onValueChange = { onSeek(it.toInt()) },
                valueRange = 0f..maxOf(totalFrames - 1, 1).toFloat(),
                colors = SliderDefaults.colors(thumbColor = Neon, activeTrackColor = Neon, inactiveTrackColor = Ink700),
                modifier = Modifier.fillMaxWidth(),
            )

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { onSeek(0) }) {
                    Icon(Icons.Default.SkipPrevious, null, tint = Slate400)
                }

                IconButton(onClick = onPlayPause, modifier = Modifier.size(48.dp)) {
                    Icon(
                        if (isPlaying) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                        null, tint = Neon, modifier = Modifier.size(40.dp),
                    )
                }

                Text(
                    "$currentFrame / $totalFrames",
                    color = Slate500,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(start = 4.dp),
                )

                Spacer(Modifier.weight(1f))

                Box {
                    TextButton(onClick = { showSpeedMenu = true }) {
                        Text(
                            "${if (speed == speed.toInt().toFloat()) speed.toInt() else speed}×",
                            color = Neon,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    DropdownMenu(
                        expanded = showSpeedMenu,
                        onDismissRequest = { showSpeedMenu = false },
                    ) {
                        speeds.forEach { s ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        "${if (s == s.toInt().toFloat()) s.toInt() else s}×",
                                        color = if (s == speed) Neon else Slate200,
                                    )
                                },
                                onClick = { onSetSpeed(s); showSpeedMenu = false },
                                trailingIcon = {
                                    if (s == speed) Icon(Icons.Default.Check, null, tint = Neon, modifier = Modifier.size(14.dp))
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
