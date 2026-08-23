package app.novossh.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.OrgMember
import app.novossh.android.viewmodel.Organization
import app.novossh.android.viewmodel.OrganizationViewModel
import app.novossh.android.viewmodel.Team

// ─── List screen ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrganizationsScreen(viewModel: OrganizationViewModel, navController: NavController) {
    val orgs by viewModel.organizations.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var showCreate by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.fetchOrganizations() }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Organizations", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    IconButton(onClick = { showCreate = true }) {
                        Icon(Icons.Default.Add, null, tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        when {
            isLoading && orgs.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Neon)
                }
            }
            orgs.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(Icons.Default.Business, null, Modifier.size(56.dp), tint = Slate600)
                        Text("No Organizations", color = Slate400, fontSize = 16.sp)
                        Button(
                            onClick = { showCreate = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                        ) { Text("Create Organization") }
                    }
                }
            }
            else -> {
                LazyColumn(Modifier.fillMaxSize().padding(padding)) {
                    items(orgs, key = { it.id }) { org ->
                        OrgListItem(org = org, onClick = {
                            navController.navigate("org-detail/${org.id}/${org.name}")
                        })
                        HorizontalDivider(color = Ink800, thickness = 0.5.dp)
                    }
                }
            }
        }
    }

    if (showCreate) {
        CreateOrgDialog(
            onDismiss = { showCreate = false },
            onCreate = { name, slug, desc ->
                viewModel.createOrganization(name, slug, desc) {}
                showCreate = false
            },
        )
    }
}

@Composable
private fun OrgListItem(org: Organization, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = Color.Transparent,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier.size(40.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(shape = RoundedCornerShape(8.dp), color = Neon.copy(alpha = 0.12f), modifier = Modifier.fillMaxSize()) {}
                Text(
                    org.name.first().uppercase(),
                    color = Neon,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(org.name, color = Slate100, fontWeight = FontWeight.Medium)
                Text("@${org.slug}", color = Neon, fontSize = 12.sp)
            }
            Icon(Icons.Default.ChevronRight, null, tint = Slate600)
        }
    }
}

@Composable
private fun CreateOrgDialog(onDismiss: () -> Unit, onCreate: (String, String, String?) -> Unit) {
    var name by remember { mutableStateOf("") }
    var slug by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("New Organization", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name, onValueChange = {
                        name = it
                        if (slug.isEmpty()) slug = it.lowercase().replace(" ", "-").filter { c -> c.isLetterOrDigit() || c == '-' }
                    },
                    label = { Text("Name") }, singleLine = true,
                    colors = orgFieldColors(),
                )
                OutlinedTextField(
                    value = slug, onValueChange = { slug = it },
                    label = { Text("Slug") }, singleLine = true,
                    leadingIcon = { Text("@", color = Slate500) },
                    colors = orgFieldColors(),
                )
                OutlinedTextField(
                    value = description, onValueChange = { description = it },
                    label = { Text("Description (optional)") }, singleLine = true,
                    colors = orgFieldColors(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onCreate(name, slug, description.ifEmpty { null }) },
                enabled = name.isNotEmpty() && slug.isNotEmpty(),
            ) { Text("Create", color = Neon) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

// ─── Detail screen ────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrgDetailScreen(
    orgId: String,
    orgName: String,
    viewModel: OrganizationViewModel,
    navController: NavController,
) {
    val members by viewModel.members.collectAsState()
    val teams by viewModel.teams.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showCreateTeam by remember { mutableStateOf(false) }
    var editingMember by remember { mutableStateOf<OrgMember?>(null) }

    LaunchedEffect(Unit) {
        viewModel.fetchMembers(orgId)
        viewModel.fetchTeams()
    }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text(orgName, color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                actions = {
                    var showMenu by remember { mutableStateOf(false) }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, null, tint = Slate400)
                        }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            DropdownMenuItem(
                                text = { Text("Delete", color = TerminalRed) },
                                leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) },
                                onClick = { showMenu = false; showDeleteConfirm = true },
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            // Tab row
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Ink900,
                contentColor = Neon,
                indicator = { tabs ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabs[selectedTab]),
                        color = Neon,
                    )
                },
            ) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                    Text("Members", color = if (selectedTab == 0) Neon else Slate500, modifier = Modifier.padding(vertical = 12.dp))
                }
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                    Text("Teams", color = if (selectedTab == 1) Neon else Slate500, modifier = Modifier.padding(vertical = 12.dp))
                }
            }

            if (selectedTab == 0) {
                // Members
                if (isLoading && members.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Neon) }
                } else {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(members, key = { it.id }) { member ->
                            MemberListItem(
                                member = member,
                                onRemove = { viewModel.removeMember(orgId, member.id) },
                                onEditRole = { editingMember = member },
                            )
                            HorizontalDivider(color = Ink800, thickness = 0.5.dp)
                        }
                    }
                }
            } else {
                // Teams
                Box(Modifier.fillMaxSize()) {
                    if (isLoading && teams.isEmpty()) {
                        CircularProgressIndicator(color = Neon, modifier = Modifier.align(Alignment.Center))
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            items(teams, key = { it.id }) { team ->
                                TeamListItem(team = team, onDelete = { viewModel.deleteTeam(team.id) })
                                HorizontalDivider(color = Ink800, thickness = 0.5.dp)
                            }
                        }
                    }
                    FloatingActionButton(
                        onClick = { showCreateTeam = true },
                        containerColor = Neon,
                        contentColor = Ink950,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
                    ) { Icon(Icons.Default.Add, null) }
                }
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = Ink800,
            title = { Text("Delete $orgName?", color = Slate100) },
            text = { Text("This action cannot be undone.", color = Slate400) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteOrganization(orgId)
                    showDeleteConfirm = false
                    navController.popBackStack()
                }) { Text("Delete", color = TerminalRed) }
            },
            dismissButton = { TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancel", color = Slate400) } },
        )
    }

    if (showCreateTeam) {
        CreateTeamDialog(
            onDismiss = { showCreateTeam = false },
            onCreate = { name, desc ->
                viewModel.createTeam(name, desc) {}
                showCreateTeam = false
            },
        )
    }

    editingMember?.let { member ->
        RolePickerDialog(
            currentRole = member.role,
            onDismiss = { editingMember = null },
            onSelect = { role ->
                viewModel.updateMemberRole(orgId, member.id, role)
                editingMember = null
            },
        )
    }
}

@Composable
private fun MemberListItem(member: OrgMember, onRemove: () -> Unit, onEditRole: () -> Unit) {
    var showMenu by remember { mutableStateOf(false) }

    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Surface(shape = RoundedCornerShape(50), color = Neon.copy(alpha = 0.12f), modifier = Modifier.size(36.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    (member.username ?: member.email ?: "?").first().uppercase(),
                    color = Neon, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                )
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(member.username ?: member.email ?: member.userId, color = Slate100, fontSize = 14.sp)
            member.email?.let { Text(it, color = Slate500, fontSize = 11.sp) }
        }
        RoleBadge(role = member.role)
        Box {
            IconButton(onClick = { showMenu = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.MoreVert, null, tint = Slate600, modifier = Modifier.size(18.dp))
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Change Role") },
                    leadingIcon = { Icon(Icons.Default.PersonPin, null, tint = Slate400) },
                    onClick = { showMenu = false; onEditRole() },
                )
                DropdownMenuItem(
                    text = { Text("Remove", color = TerminalRed) },
                    leadingIcon = { Icon(Icons.Default.PersonRemove, null, tint = TerminalRed) },
                    onClick = { showMenu = false; onRemove() },
                )
            }
        }
    }
}

@Composable
private fun RoleBadge(role: String) {
    val color = when (role) {
        "owner" -> Color(0xFFf97316)
        "admin" -> Neon
        else -> Slate500
    }
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f)) {
        Text(
            role, color = color, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun TeamListItem(team: Team, onDelete: () -> Unit) {
    var showMenu by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Group, null, tint = Slate500, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(team.name, color = Slate100, fontWeight = FontWeight.Medium)
            team.description?.let { Text(it, color = Slate500, fontSize = 12.sp, maxLines = 1) }
        }
        Box {
            IconButton(onClick = { showMenu = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.MoreVert, null, tint = Slate600, modifier = Modifier.size(18.dp))
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Delete", color = TerminalRed) },
                    leadingIcon = { Icon(Icons.Default.Delete, null, tint = TerminalRed) },
                    onClick = { showMenu = false; onDelete() },
                )
            }
        }
    }
}

@Composable
private fun RolePickerDialog(currentRole: String, onDismiss: () -> Unit, onSelect: (String) -> Unit) {
    val roles = listOf("owner", "admin", "member", "viewer")
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("Change Role", color = Slate100) },
        text = {
            Column {
                roles.forEach { role ->
                    TextButton(onClick = { onSelect(role) }, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(role.replaceFirstChar { it.uppercase() }, color = if (role == currentRole) Neon else Slate300)
                            Spacer(Modifier.weight(1f))
                            if (role == currentRole) Icon(Icons.Default.Check, null, tint = Neon, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

@Composable
private fun CreateTeamDialog(onDismiss: () -> Unit, onCreate: (String, String?) -> Unit) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ink800,
        title = { Text("New Team", color = Slate100) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text("Team name") }, singleLine = true, colors = orgFieldColors(),
                )
                OutlinedTextField(
                    value = description, onValueChange = { description = it },
                    label = { Text("Description (optional)") }, singleLine = true, colors = orgFieldColors(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onCreate(name, description.ifEmpty { null }) }, enabled = name.isNotEmpty()) {
                Text("Create", color = Neon)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Slate400) } },
    )
}

@Composable
private fun orgFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Slate100, unfocusedTextColor = Slate100,
    focusedBorderColor = Neon, unfocusedBorderColor = Ink600, cursorColor = Neon,
    focusedLabelColor = Neon, unfocusedLabelColor = Slate500,
)
