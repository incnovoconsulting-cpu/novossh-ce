package app.novossh.android.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.models.Host
import app.novossh.android.models.SFTPFile
import app.novossh.android.ssh.SFTPService
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SFTPSessionScreen(viewModel: AppViewModel, hostId: String, navController: NavController) {
    val context = LocalContext.current
    val hosts by viewModel.hosts.collectAsState()
    val host = hosts.firstOrNull { it.id == hostId } ?: run {
        navController.popBackStack(); return
    }
    val keys by viewModel.keys.collectAsState()
    val scope = rememberCoroutineScope()

    val sftpService = remember { SFTPService(context) }
    var isConnected by remember { mutableStateOf(false) }
    var isConnecting by remember { mutableStateOf(true) }
    var currentPath by remember { mutableStateOf("/") }
    var files by remember { mutableStateOf<List<SFTPFile>>(emptyList()) }
    var isLoadingFiles by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Dialog state for Creating Folder
    var showMkdirDialog by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }

    // Hidden files toggle
    var showHiddenFiles by remember { mutableStateOf(false) }

    // Rename dialog state
    var showRenameDialog by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<SFTPFile?>(null) }
    var renameNewName by remember { mutableStateOf("") }

    // Connect trigger
    LaunchedEffect(hostId) {
        isConnecting = true
        errorMessage = null
        val password = if (host.authMethod.name == "PASSWORD") viewModel.getPassword(host) else null
        val key = host.keyId?.let { kid -> keys.firstOrNull { it.id == kid } }
        val privateKey = key?.let { viewModel.getPrivateKey(it) }
        val success = sftpService.connect(host, password, privateKey)
        isConnecting = false
        isConnected = success
        if (!success) {
            errorMessage = "Failed to connect to SFTP"
        }
    }

    // Refresh files list
    val refreshFiles = suspend {
        if (isConnected) {
            isLoadingFiles = true
            errorMessage = null
            files = sftpService.listFiles(currentPath)
            isLoadingFiles = false
        }
    }

    // List files when path or connection changes
    LaunchedEffect(currentPath, isConnected) {
        if (isConnected) {
            refreshFiles()
        }
    }

    // File picker for upload
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            scope.launch {
                val cursor = context.contentResolver.query(uri, null, null, null, null)
                val nameIndex = cursor?.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                var displayName = "uploaded_file"
                if (cursor != null && nameIndex != null && cursor.moveToFirst()) {
                    displayName = cursor.getString(nameIndex)
                }
                cursor?.close()

                val inputStream = context.contentResolver.openInputStream(uri)
                if (inputStream != null) {
                    isLoadingFiles = true
                    val remoteDest = if (currentPath == "/") "/$displayName" else "$currentPath/$displayName"
                    val ok = sftpService.uploadFile(inputStream, remoteDest)
                    if (ok) {
                        Toast.makeText(context, "Uploaded $displayName successfully", Toast.LENGTH_SHORT).show()
                        refreshFiles()
                    } else {
                        Toast.makeText(context, "Upload failed", Toast.LENGTH_SHORT).show()
                        isLoadingFiles = false
                    }
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            scope.launch {
                sftpService.disconnect()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(host.label, fontWeight = FontWeight.SemiBold, color = Slate100, fontSize = 14.sp)
                        Text(currentPath, fontSize = 12.sp, color = Slate400, fontFamily = FontFamily.Monospace)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { scope.launch { sftpService.disconnect() }; navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Slate400)
                    }
                },
                actions = {
                    if (isConnected) {
                        IconButton(onClick = { showHiddenFiles = !showHiddenFiles }) {
                            Icon(
                                if (showHiddenFiles) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = "Toggle hidden files",
                                tint = if (showHiddenFiles) Neon else Slate400,
                            )
                        }
                        IconButton(onClick = { showMkdirDialog = true }) {
                            Icon(Icons.Default.CreateNewFolder, "Create Folder", tint = Slate400)
                        }
                        IconButton(onClick = { filePickerLauncher.launch("*/*") }) {
                            Icon(Icons.Default.Upload, "Upload File", tint = Slate400)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        },
        containerColor = Ink950,
    ) { padding ->
        when {
            isConnecting -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Neon)
                        Spacer(Modifier.height(16.dp))
                        Text("Connecting to SFTP...", color = Slate400)
                    }
                }
            }
            isConnected -> {
                if (isLoadingFiles) {
                    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Neon)
                    }
                } else {
                    val visibleFiles = if (showHiddenFiles) files else files.filter { !it.name.startsWith(".") }
                    Column(Modifier.fillMaxSize().padding(padding)) {
                    LazyColumn(Modifier.weight(1f)) {
                        // Parent directory
                        if (currentPath != "/") {
                            item {
                                Card(
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 4.dp)
                                        .clickable {
                                            val parent = currentPath.substringBeforeLast('/')
                                            currentPath = if (parent.isEmpty()) "/" else parent
                                        },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Ink800),
                                ) {
                                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.ArrowUpward, null, tint = Slate400)
                                        Spacer(Modifier.width(12.dp))
                                        Text("..", color = Slate200, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                        items(visibleFiles, key = { it.path }) { file ->
                            FileItem(
                                file = file,
                                onClick = {
                                    if (file.isDirectory) {
                                        currentPath = if (currentPath == "/") "/${file.name}" else "$currentPath/${file.name}"
                                    }
                                },
                                onDownload = {
                                    scope.launch {
                                        Toast.makeText(context, "Starting download...", Toast.LENGTH_SHORT).show()
                                        val ok = sftpService.downloadToDownloads(file.path, file.name)
                                        if (ok) {
                                            Toast.makeText(context, "Downloaded to Downloads folder", Toast.LENGTH_LONG).show()
                                        } else {
                                            Toast.makeText(context, "Download failed", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                onRename = {
                                    renameTarget = file
                                    renameNewName = file.name
                                    showRenameDialog = true
                                },
                                onDelete = {
                                    scope.launch {
                                        val ok = sftpService.delete(file.path, file.isDirectory)
                                        if (ok) {
                                            Toast.makeText(context, "Deleted successfully", Toast.LENGTH_SHORT).show()
                                            refreshFiles()
                                        } else {
                                            Toast.makeText(context, "Delete failed", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            )
                        }
                    }
                    // Status bar
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Ink800,
                    ) {
                        Row(
                            Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(currentPath, color = Slate400, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                            Text("${visibleFiles.size} items", color = Slate500, fontSize = 11.sp)
                        }
                    }
                    }
                }
            }
            else -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                        Icon(Icons.Default.CloudOff, null, Modifier.size(64.dp), tint = Slate600)
                        Spacer(Modifier.height(16.dp))
                        Text("Connection Failed", style = MaterialTheme.typography.titleMedium, color = Slate400)
                        Spacer(Modifier.height(4.dp))
                        Text(errorMessage ?: "Check connection settings", color = Slate500, fontSize = 13.sp)
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = {
                                scope.launch {
                                    isConnecting = true
                                    errorMessage = null
                                    val password = if (host.authMethod.name == "PASSWORD") viewModel.getPassword(host) else null
                                    val key = host.keyId?.let { kid -> keys.firstOrNull { it.id == kid } }
                                    val privateKey = key?.let { viewModel.getPrivateKey(it) }
                                    val success = sftpService.connect(host, password, privateKey)
                                    isConnecting = false
                                    isConnected = success
                                    if (!success) {
                                        errorMessage = "Failed to connect to SFTP"
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950)
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
        }
    }

    if (showRenameDialog && renameTarget != null) {
        AlertDialog(
            onDismissRequest = { showRenameDialog = false; renameNewName = "" },
            title = { Text("Rename", color = Slate100) },
            text = {
                OutlinedTextField(
                    value = renameNewName,
                    onValueChange = { renameNewName = it },
                    label = { Text("New name") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Neon,
                        focusedLabelColor = Neon,
                        focusedTextColor = Slate100,
                        unfocusedTextColor = Slate200
                    )
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val newName = renameNewName.trim()
                        if (newName.isNotEmpty() && newName != renameTarget!!.name) {
                            scope.launch {
                                val parentDir = renameTarget!!.path.substringBeforeLast('/')
                                val newPath = if (parentDir.isEmpty()) "/$newName" else "$parentDir/$newName"
                                val ok = sftpService.rename(renameTarget!!.path, newPath)
                                if (ok) {
                                    Toast.makeText(context, "Renamed successfully", Toast.LENGTH_SHORT).show()
                                    refreshFiles()
                                } else {
                                    Toast.makeText(context, "Rename failed", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        showRenameDialog = false
                        renameNewName = ""
                    }
                ) {
                    Text("Rename", color = Neon)
                }
            },
            dismissButton = {
                TextButton(onClick = { showRenameDialog = false; renameNewName = "" }) {
                    Text("Cancel", color = Slate400)
                }
            },
            containerColor = Ink900
        )
    }

    if (showMkdirDialog) {
        AlertDialog(
            onDismissRequest = { showMkdirDialog = false; newFolderName = "" },
            title = { Text("Create Folder", color = Slate100) },
            text = {
                OutlinedTextField(
                    value = newFolderName,
                    onValueChange = { newFolderName = it },
                    label = { Text("Folder Name") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Neon,
                        focusedLabelColor = Neon,
                        focusedTextColor = Slate100,
                        unfocusedTextColor = Slate200
                    )
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val folder = newFolderName.trim()
                        if (folder.isNotEmpty()) {
                            scope.launch {
                                val remoteDest = if (currentPath == "/") "/$folder" else "$currentPath/$folder"
                                val ok = sftpService.mkdir(remoteDest)
                                if (ok) {
                                    refreshFiles()
                                } else {
                                    Toast.makeText(context, "Failed to create folder", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        showMkdirDialog = false
                        newFolderName = ""
                    }
                ) {
                    Text("Create", color = Neon)
                }
            },
            dismissButton = {
                TextButton(onClick = { showMkdirDialog = false; newFolderName = "" }) {
                    Text("Cancel", color = Slate400)
                }
            },
            containerColor = Ink900
        )
    }
}

@Composable
private fun FileItem(
    file: SFTPFile,
    onClick: () -> Unit,
    onDownload: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    Card(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 2.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                if (file.isDirectory) Icons.Default.Folder else Icons.Default.InsertDriveFile,
                null,
                tint = if (file.isDirectory) Neon else Slate400,
                modifier = Modifier.size(24.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    file.name,
                    fontWeight = FontWeight.Medium,
                    color = Slate100,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!file.isDirectory) {
                    Text(file.sizeFormatted, fontSize = 12.sp, color = Slate500)
                }
            }
            file.permissions?.let {
                Text(it, fontSize = 11.sp, color = Slate500, fontFamily = FontFamily.Monospace)
            }
            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(Icons.Default.MoreVert, "Actions", tint = Slate400)
                }
                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false },
                    modifier = Modifier.background(Ink900)
                ) {
                    if (!file.isDirectory) {
                        DropdownMenuItem(
                            text = { Text("Download", color = Slate100) },
                            onClick = {
                                showMenu = false
                                onDownload()
                            },
                            leadingIcon = { Icon(Icons.Default.Download, null, tint = Slate400) }
                        )
                    }
                    DropdownMenuItem(
                        text = { Text("Rename", color = Slate100) },
                        onClick = {
                            showMenu = false
                            onRename()
                        },
                        leadingIcon = { Icon(Icons.Default.DriveFileRenameOutline, null, tint = Slate400) }
                    )
                    DropdownMenuItem(
                        text = { Text("Delete", color = TerminalRed) },
                        onClick = {
                            showMenu = false
                            onDelete()
                        },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) }
                    )
                }
            }
        }
    }
}
