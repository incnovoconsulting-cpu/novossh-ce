package app.novossh.android.ui.screens

import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.widget.TextView
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.navigation.NavController
import app.novossh.android.ssh.SSHConnectionRouter
import app.novossh.android.ssh.SSHStatus
import app.novossh.android.ui.theme.*
import app.novossh.android.ui.theme.TERMINAL_SCHEMES
import app.novossh.android.viewmodel.AppViewModel
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import app.novossh.android.models.SessionLog
import app.novossh.android.ui.components.BroadcastInputBar
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private val DEFAULT_ANSI = intArrayOf(
    0xFF424242.toInt(), 0xFFCD3131.toInt(), 0xFF0BC161.toInt(), 0xFFC7C427.toInt(),
    0xFF0225CD.toInt(), 0xFFC930C7.toInt(), 0xFF00C5C7.toInt(), 0xFFC7C7C7.toInt(),
    0xFF686868.toInt(), 0xFFCD3131.toInt(), 0xFF0BC161.toInt(), 0xFFC7C427.toInt(),
    0xFF0225CD.toInt(), 0xFFC930C7.toInt(), 0xFF00C5C7.toInt(), 0xFFFFFFFF.toInt(),
)

private fun getAnsiColors(schemeId: String): IntArray {
    val scheme = TERMINAL_SCHEMES.find { it.id == schemeId } ?: TERMINAL_SCHEMES[0]
    return intArrayOf(
        scheme.black, scheme.red, scheme.green, scheme.yellow,
        scheme.blue, scheme.magenta, scheme.cyan, scheme.white,
        scheme.brightBlack, scheme.brightRed, scheme.brightGreen, scheme.brightYellow,
        scheme.brightBlue, scheme.brightMagenta, scheme.brightCyan, scheme.brightWhite,
    )
}

private fun processCarriageReturns(raw: String): String {
    val result = StringBuilder()
    var lineStart = 0
    var i = 0
    while (i < raw.length) {
        when {
            raw[i] == '\r' && i + 1 < raw.length && raw[i + 1] == '\n' -> {
                result.append('\n'); lineStart = result.length; i += 2
            }
            raw[i] == '\r' -> { result.delete(lineStart, result.length); i++ }
            raw[i] == '\n' -> { result.append('\n'); lineStart = result.length; i++ }
            else -> { result.append(raw[i]); i++ }
        }
    }
    return result.toString()
}

private fun parseAnsi(raw: String, schemeId: String = "novo-dark"): SpannableStringBuilder {
    val ansiColors = getAnsiColors(schemeId)
    val defaultFg = TERMINAL_SCHEMES.find { it.id == schemeId }?.foreground ?: 0xFFE2E8F0.toInt()
    return try {
        var text = processCarriageReturns(raw)
            // OSC sequences (title, hyperlinks) — must strip BEFORE bare \u0007
            .replace(Regex("\u001b\\]8;[^\\u0007\u001b]*[\u0007\u001b\\\\]"), "")
            .replace(Regex("\u001b\\][^\u0007\u001b]*[\u0007\u001b\\\\]"), "")
            // CSI cursor movement / erase
            .replace(Regex("\u001b\\[[0-9;]*[ABCD]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[Hf]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[JK]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[ST]"), "")
            .replace(Regex("\u001b\\[\\??[0-9;]*[hlp]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[hl]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[nR]"), "")
            .replace(Regex("\u001b\\[\\?[0-9;]*[c]"), "")
            // Strip remaining bare control chars
            .replace("\u0007", "").replace("\u0008", "")
            .replace(Regex("\u001b\\[3[89];5;[0-9;]*m"), "\u001b[0m")
            .replace(Regex("\u001b\\[38;2;[0-9;]*m"), "\u001b[0m")
            .replace(Regex("\u001b\\[4[89];5;[0-9;]*m"), "\u001b[0m")
            .replace(Regex("\u001b\\[48;2;[0-9;]*m"), "\u001b[0m")
            .replace(Regex("\u001b\\[4[0-7]m"), "\u001b[0m")
            .replace(Regex("\u001b\\[[0-9;]*[ABCDEFGHJKSTfn]"), "")
            .replace(Regex("\u001b\\[[0-9;]*[m]"), "\u001b[0m")

        val builder = SpannableStringBuilder()
        var currentColor = defaultFg
        var isBold = false; var isUnderline = false; var isDim = false
        var lastIndex = 0
        val colorRegex = Regex("\u001b\\[([0-9;]*)m")
        for (match in colorRegex.findAll(text)) {
            if (match.range.first > lastIndex) {
                val segment = text.substring(lastIndex, match.range.first)
                val start = builder.length
                builder.append(segment)
                applySpans(builder, start, builder.length, currentColor, isBold, isUnderline, isDim)
            }
            for (code in match.groupValues[1].split(";").mapNotNull { it.toIntOrNull() }) {
                when {
                    code == 0 -> { currentColor = defaultFg; isBold = false; isUnderline = false; isDim = false }
                    code == 1 -> isBold = true
                    code == 2 -> isDim = true
                    code == 4 -> isUnderline = true
                    code == 22 -> isBold = false
                    code == 24 -> isUnderline = false
                    code == 25 -> isDim = false
                    code in 30..37 -> currentColor = ansiColors[code - 30]
                    code in 90..97 -> currentColor = ansiColors[code - 90 + 8]
                }
            }
            lastIndex = match.range.last + 1
        }
        if (lastIndex < text.length) {
            val segment = text.substring(lastIndex)
            val start = builder.length
            builder.append(segment)
            applySpans(builder, start, builder.length, currentColor, isBold, isUnderline, isDim)
        }
        builder
    } catch (e: Exception) {
        SpannableStringBuilder(raw.replace("\r", "\n"))
    }
}

private fun applySpans(builder: SpannableStringBuilder, start: Int, end: Int, color: Int, bold: Boolean, underline: Boolean, dim: Boolean) {
    if (start >= end) return
    builder.setSpan(ForegroundColorSpan(if (dim) (color and 0x00FFFFFF) or 0x80000000.toInt() else color), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    if (bold) builder.setSpan(android.text.style.StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    if (underline) builder.setSpan(android.text.style.UnderlineSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
}

private fun highlightSearch(tv: TextView, query: String, activeIndex: Int) {
    val text = tv.text?.toString() ?: return
    val ssb = SpannableStringBuilder(text)
    // Clear old highlights
    ssb.getSpans(0, ssb.length, BackgroundColorSpan::class.java).forEach { ssb.removeSpan(it) }
    val lowerText = text.lowercase()
    val lowerQuery = query.lowercase()
    var idx = 0
    var matchNum = 0
    while (idx < lowerText.length) {
        val found = lowerText.indexOf(lowerQuery, idx)
        if (found == -1) break
        val end = found + query.length
        val bg = if (matchNum == activeIndex) 0xFFFFAA00.toInt() else 0x55FFFF00.toInt()
        ssb.setSpan(BackgroundColorSpan(bg), found, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        idx = end
        matchNum++
    }
    tv.text = ssb
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TerminalScreen(viewModel: AppViewModel, hostId: String, navController: NavController) {
    val hosts by viewModel.hosts.collectAsState()
    val host = hosts.firstOrNull { it.id == hostId } ?: run {
        navController.popBackStack(); return
    }
    val keys by viewModel.keys.collectAsState()
    val settings by viewModel.settings.collectAsState()

    val sshService = remember { SSHConnectionRouter() }
    var sshStatus by remember { mutableStateOf(SSHStatus.IDLE) }
    val outputLines = remember { mutableStateListOf<String>() }
    var outputText by remember { mutableStateOf("") }
    var inputText by remember { mutableStateOf("") }
    var fontSize by remember { mutableFloatStateOf(settings.fontSize.toFloat()) }
    var showBroadcast by remember { mutableStateOf(false) }
    var showSearch by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var searchMatchCount by remember { mutableIntStateOf(0) }
    var searchMatchIndex by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    // Receive broadcast from other sessions
    LaunchedEffect(Unit) {
        viewModel.broadcastFlow.collectLatest { text ->
            if (sshStatus == SSHStatus.CONNECTED) {
                scope.launch { sshService.sendInput("$text\n") }
            }
        }
    }

    // Parse keyboard buttons from settings
    val keyboardKeys = remember(settings.keyboardButtons) {
        settings.keyboardButtons.split(",").map { it.trim() }.filter { it.isNotEmpty() }.map { label ->
            val code = when (label) {
                "Tab" -> "\t"
                "Esc" -> "\u001b"
                "^C" -> "\u0003"
                "^D" -> "\u0004"
                "^Z" -> "\u001a"
                "^L" -> "\u000c"
                "^[" -> "\u001b"
                "↑" -> "\u001b[A"
                "↓" -> "\u001b[B"
                "←" -> "\u001b[D"
                "→" -> "\u001b[C"
                "Home" -> "\u001b[H"
                "End" -> "\u001b[F"
                "PgUp" -> "\u001b[5~"
                "PgDn" -> "\u001b[6~"
                "Ins" -> "\u001b[2~"
                "Del" -> "\u001b[3~"
                "F1" -> "\u001bOP"
                "F2" -> "\u001bOQ"
                "F3" -> "\u001bOR"
                "F4" -> "\u001bOS"
                else -> label
            }
            label to code
        }
    }

    // Auto-scroll to bottom
    fun scrollToBottom(textView: TextView?) {
        textView?.post {
            val layout = textView.layout ?: return@post
            val scrollAmount = layout.getLineTop(textView.lineCount) - textView.height
            if (scrollAmount > 0) textView.scrollTo(0, scrollAmount)
        }
    }

    var textViewRef by remember { mutableStateOf<TextView?>(null) }

    // Re-highlight search matches when query or output changes
    LaunchedEffect(searchQuery, outputText, settings.terminalScheme) {
        val tv = textViewRef ?: return@LaunchedEffect
        if (searchQuery.isEmpty()) {
            // Restore plain parsed text
            tv.text = parseAnsi(outputText, settings.terminalScheme)
            searchMatchCount = 0
            searchMatchIndex = 0
            return@LaunchedEffect
        }
        val plainText = tv.text?.toString() ?: return@LaunchedEffect
        val lowerText = plainText.lowercase()
        val lowerQuery = searchQuery.lowercase()
        var count = 0
        var idx = 0
        while (idx < lowerText.length) {
            val found = lowerText.indexOf(lowerQuery, idx)
            if (found == -1) break
            count++
            idx = found + searchQuery.length
        }
        searchMatchCount = count
        if (count > 0) {
            searchMatchIndex = searchMatchIndex.coerceIn(0, count - 1)
            highlightSearch(tv, searchQuery, searchMatchIndex)
        }
    }

    sshService.onData = { data ->
        val text = String(data, Charsets.UTF_8)
        try {
            scope.launch {
                outputLines.add(text)
                if (outputLines.size > settings.scrollback) {
                    val removeCount = outputLines.size - (settings.scrollback * 0.8).toInt()
                    repeat(removeCount) { outputLines.removeAt(0) }
                }
                outputText = outputLines.joinToString("")
            }
        } catch (e: Exception) {
            android.util.Log.e("TerminalScreen", "onData error: ${e.message}")
        }
    }
    sshService.onStateChange = { state ->
        sshStatus = state
        try {
            scope.launch {
                when (state) {
                    SSHStatus.CONNECTING -> outputLines.add("\u001b[33mConnecting to ${host.username}@${host.address}:${host.port}...\u001b[0m\n")
                    SSHStatus.CONNECTED -> outputLines.add("\u001b[32mConnected!\u001b[0m\n\n")
                    SSHStatus.FAILED -> outputLines.add("\n\u001b[31mConnection failed\u001b[0m\n")
                    SSHStatus.DISCONNECTED -> outputLines.add("\n\u001b[33mDisconnected\u001b[0m\n")
                    else -> {}
                }
                outputText = outputLines.joinToString("")
            }
        } catch (e: Exception) {
            android.util.Log.e("TerminalScreen", "onStateChange error: ${e.message}")
        }
    }

    LaunchedEffect(hostId) {
        val password = if (host.authMethod.name == "PASSWORD") viewModel.getPassword(host) else null
        val key = host.keyId?.let { kid -> keys.firstOrNull { it.id == kid } }
        val privateKey = key?.let { viewModel.getPrivateKey(it) }
        sshService.connect(host, password, privateKey, viewModel.getAuthToken())
    }

    DisposableEffect(Unit) {
        onDispose {
            scope.launch {
                sshService.disconnect()
                // Save session log locally
                if (outputLines.isNotEmpty()) {
                    viewModel.addSessionLog(SessionLog(
                        hostId = hostId,
                        hostLabel = host.label,
                        startedAt = System.currentTimeMillis() - (outputLines.size * 100L),
                        endedAt = System.currentTimeMillis(),
                        commandCount = outputLines.count { it.contains("$") || it.contains("#") },
                    ))
                }
            }
        }
    }

    Column(Modifier.fillMaxSize().background(Ink950)) {
        TopAppBar(
            title = { Text(host.label, fontFamily = FontFamily.Monospace, color = Slate100) },
            navigationIcon = {
                IconButton(onClick = { scope.launch { sshService.disconnect() }; navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Slate400)
                }
            },
            actions = {
                IconButton(onClick = { showSearch = !showSearch; if (!showSearch) { searchQuery = "" } }) {
                    Icon(
                        if (showSearch) Icons.Default.Close else Icons.Default.Search,
                        contentDescription = "Search terminal",
                        tint = if (showSearch) Neon else Slate400,
                    )
                }
                IconButton(onClick = { showBroadcast = !showBroadcast }) {
                    Icon(
                        if (showBroadcast) Icons.Default.WifiOff else Icons.Default.Wifi,
                        contentDescription = "Broadcast input",
                        tint = if (showBroadcast) Neon else Slate400,
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
        )

        when (sshStatus) {
            SSHStatus.CONNECTING -> LinearProgressIndicator(Modifier.fillMaxWidth(), color = Neon, trackColor = Ink800)
            else -> {}
        }

        // Reconnection banner
        if (sshStatus == SSHStatus.FAILED || sshStatus == SSHStatus.DISCONNECTED) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = TerminalRed.copy(alpha = 0.12f),
            ) {
                Row(
                    Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.WifiOff, null, tint = TerminalRed, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(
                        if (sshStatus == SSHStatus.FAILED) "Connection failed" else "Disconnected",
                        color = TerminalRed,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            scope.launch {
                                sshStatus = SSHStatus.CONNECTING
                                val password = if (host.authMethod.name == "PASSWORD") viewModel.getPassword(host) else null
                                val key = host.keyId?.let { kid -> keys.firstOrNull { it.id == kid } }
                                val privateKey = key?.let { viewModel.getPrivateKey(it) }
                                sshService.connect(host, password, privateKey, viewModel.getAuthToken())
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerminalRed, contentColor = Slate100),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp),
                    ) {
                        Icon(Icons.Default.Autorenew, null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Reconnect", fontSize = 12.sp)
                    }
                }
            }
        }

        // Search bar
        if (showSearch) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Ink800,
            ) {
                Row(
                    Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Find in terminal...", color = Slate500, fontSize = 13.sp) },
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = Slate100,
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Neon,
                            unfocusedBorderColor = Ink600,
                            cursorColor = Neon,
                            focusedContainerColor = Ink900,
                            unfocusedContainerColor = Ink900,
                        ),
                    )
                    if (searchQuery.isNotEmpty()) {
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "${searchMatchIndex + 1}/$searchMatchCount",
                            color = Slate400,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 4.dp),
                        )
                        IconButton(onClick = {
                            textViewRef?.let { tv ->
                                val text = tv.text?.toString() ?: ""
                                if (searchQuery.isNotEmpty() && searchMatchCount > 0) {
                                    searchMatchIndex = (searchMatchIndex - 1 + searchMatchCount) % searchMatchCount
                                    highlightSearch(tv, searchQuery, searchMatchIndex)
                                }
                            }
                        }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.KeyboardArrowUp, "Previous", tint = Slate300, modifier = Modifier.size(18.dp))
                        }
                        IconButton(onClick = {
                            textViewRef?.let { tv ->
                                if (searchQuery.isNotEmpty() && searchMatchCount > 0) {
                                    searchMatchIndex = (searchMatchIndex + 1) % searchMatchCount
                                    highlightSearch(tv, searchQuery, searchMatchIndex)
                                }
                            }
                        }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.KeyboardArrowDown, "Next", tint = Slate300, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }

        // Terminal output with pinch-to-zoom
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .pointerInput(Unit) {
                    detectTransformGestures { _, _, zoom, _ ->
                        fontSize = (fontSize * zoom).coerceIn(8f, 32f)
                    }
                },
        ) {
            val currentScheme = TERMINAL_SCHEMES.find { it.id == settings.terminalScheme } ?: TERMINAL_SCHEMES[0]
            AndroidView(
                factory = { ctx ->
                    TextView(ctx).apply {
                        typeface = TerminalFontProvider.getFont(settings.fontFamily).typeface
                        textSize = settings.fontSize.toFloat()
                        setTextColor(currentScheme.foreground)
                        setLineSpacing(0f, 1.2f)
                        setPadding(12, 8, 12, 8)
                        setBackgroundColor(currentScheme.background)
                        setTextIsSelectable(true)
                        movementMethod = android.text.method.ScrollingMovementMethod()
                        isHorizontalScrollBarEnabled = true
                        isVerticalScrollBarEnabled = true
                        // Copy on select
                        setTextIsSelectable(true)
                        customSelectionActionModeCallback = object : android.view.ActionMode.Callback {
                            override fun onCreateActionMode(mode: android.view.ActionMode?, menu: android.view.Menu?): Boolean = true
                            override fun onPrepareActionMode(mode: android.view.ActionMode?, menu: android.view.Menu?): Boolean = false
                            override fun onActionItemClicked(mode: android.view.ActionMode?, item: android.view.MenuItem?): Boolean = false
                            override fun onDestroyActionMode(mode: android.view.ActionMode?) {
                                if (settings.copyOnSelect) {
                                    val start = selectionStart
                                    val end = selectionEnd
                                    if (start >= 0 && end > start) {
                                        val selected = text?.subSequence(start, end)?.toString() ?: return
                                        val clipboard = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("terminal", selected))
                                    }
                                }
                            }
                        }
                    }.also { textViewRef = it }
                },
                update = { tv ->
                    tv.textSize = fontSize
                    tv.setTextColor(currentScheme.foreground)
                    tv.setBackgroundColor(currentScheme.background)
                    if (searchQuery.isEmpty()) {
                        tv.text = parseAnsi(outputText, settings.terminalScheme)
                    }
                    scrollToBottom(tv)
                },
                modifier = Modifier.fillMaxSize(),
            )
            // Connection status badge
            if (sshStatus == SSHStatus.CONNECTED) {
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = Ink800.copy(alpha = 0.85f),
                ) {
                    Text(
                        "direct",
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        color = TerminalGreen,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }

        // Keyboard addon toolbar
        if (sshStatus == SSHStatus.CONNECTED) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Ink900,
                tonalElevation = 0.dp,
            ) {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    keyboardKeys.forEach { (label, code) ->
                        OutlinedButton(
                            onClick = { scope.launch { sshService.sendInput(code) } },
                            modifier = Modifier.height(32.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300),
                            border = ButtonDefaults.outlinedButtonBorder,
                        ) {
                            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }

        // Broadcast bar
        if (sshStatus == SSHStatus.CONNECTED && showBroadcast) {
            BroadcastInputBar(onSend = { text ->
                viewModel.broadcast(text)
                scope.launch { sshService.sendInput("$text\n") }
            })
        }

        // Input bar
        if (sshStatus == SSHStatus.CONNECTED) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Ink900,
                tonalElevation = 0.dp,
            ) {
                Row(
                    Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("$ ", color = Slate500, fontFamily = FontFamily.Monospace, fontSize = 13.sp) },
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = Slate100,
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = {
                            if (settings.sendOnEnter) {
                                val text = inputText
                                scope.launch { sshService.sendInput(text + "\n") }
                                inputText = ""
                            }
                        }),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Neon,
                            unfocusedBorderColor = Ink600,
                            cursorColor = Neon,
                            focusedContainerColor = Ink800,
                            unfocusedContainerColor = Ink800,
                        ),
                    )
                    Spacer(Modifier.width(6.dp))
                    FilledIconButton(
                        onClick = {
                            val text = inputText
                            scope.launch { sshService.sendInput(text + "\n") }
                            inputText = ""
                        },
                        modifier = Modifier.size(40.dp),
                        colors = IconButtonDefaults.filledIconButtonColors(
                            containerColor = Neon,
                            contentColor = Ink950,
                        ),
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, "Send", modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}
