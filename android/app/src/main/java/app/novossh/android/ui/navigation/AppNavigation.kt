package app.novossh.android.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import app.novossh.android.BuildConfig
import app.novossh.android.ui.screens.*
import app.novossh.android.ui.theme.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.novossh.android.ui.components.CommandPaletteSheet
import app.novossh.android.ui.screens.AnalyticsDashboardScreen
import app.novossh.android.ui.screens.AuditLogScreen
import app.novossh.android.ui.screens.NotificationsScreen
import app.novossh.android.ui.screens.SessionListScreen
import app.novossh.android.ui.screens.SessionPlaybackScreen
import app.novossh.android.viewmodel.AnalyticsViewModel
import app.novossh.android.viewmodel.AppViewModel
import app.novossh.android.viewmodel.AuditViewModel
import app.novossh.android.viewmodel.AuthViewModel
import app.novossh.android.viewmodel.NotificationViewModel
import app.novossh.android.viewmodel.SessionPlaybackViewModel
import app.novossh.android.viewmodel.OrganizationViewModel
import app.novossh.android.viewmodel.SecurityViewModel
import app.novossh.android.viewmodel.BillingViewModel
import app.novossh.android.viewmodel.P2PViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import app.novossh.android.billing.Feature
import app.novossh.android.billing.PaywallGate

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Hosts : Screen("hosts", "Hosts", Icons.Default.Computer)
    object Vault : Screen("vault", "Vault", Icons.Default.Lock)
    object Snippets : Screen("snippets", "Snippets", Icons.Default.Code)
    object Keys : Screen("keys", "Keys", Icons.Default.Key)
    object SFTP : Screen("sftp", "SFTP", Icons.Default.Folder)
    object History : Screen("history", "History", Icons.Default.History)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
    object PortForwarding : Screen("port-forwarding", "Port Forwarding", Icons.Default.SwapHoriz)
    object Notifications : Screen("notifications", "Notifications", Icons.Default.Notifications)
    object Sessions : Screen("sessions", "Sessions", Icons.Default.PlayCircle)
    object Analytics : Screen("analytics", "Analytics", Icons.Default.BarChart)
    object AuditLog : Screen("audit-log", "Audit Log", Icons.Default.Article)
    object Organizations : Screen("organizations", "Organizations", Icons.Default.Business)
    object Security : Screen("security", "Security", Icons.Default.Security)
    object Billing : Screen("billing", "Billing", Icons.Default.CreditCard)
    object P2P : Screen("p2p", "P2P", Icons.Default.People)
}

val bottomNavItems = listOf(Screen.Hosts, Screen.Vault, Screen.Snippets, Screen.Keys)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavigation(viewModel: AppViewModel, authViewModel: AuthViewModel) {
    val authState by authViewModel.authState.collectAsState()

    if (authState.isLoading) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Ink950),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(color = Neon)
        }
        return
    }

    if (!authState.isAuthenticated) {
        val authNavController = rememberNavController()
        NavHost(navController = authNavController, startDestination = "login") {
            composable("login") {
                LoginScreen(
                    authViewModel = authViewModel,
                    onLoginSuccess = { },
                    onSwitchToSignup = { authNavController.navigate("signup") { launchSingleTop = true } },
                    onOpenDebug = { authNavController.navigate("debug") { launchSingleTop = true } },
                )
            }
            composable("signup") {
                SignupScreen(
                    authViewModel = authViewModel,
                    onSignupSuccess = { },
                    onSwitchToLogin = { authNavController.navigate("login") { launchSingleTop = true; popUpTo(0) } },
                )
            }
            composable("debug") {
                DebugLogScreen(onBack = { authNavController.popBackStack() })
            }
        }
        return
    }

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDest = navBackStackEntry?.destination
    val currentRoute = currentDest?.route

    // Email verification banner
    var showVerificationBanner by remember { mutableStateOf(!authState.emailVerified) }
    var verificationMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(authState.emailVerified) {
        showVerificationBanner = !authState.emailVerified
    }

    val isTerminalOrSFTP = currentRoute?.startsWith("terminal") == true || currentRoute?.startsWith("sftp/") == true
    val currentScreen = bottomNavItems.firstOrNull { screen ->
        currentDest?.hierarchy?.any { it.route == screen.route } == true
    }

    val notificationViewModel: NotificationViewModel = viewModel()
    val unreadCount by notificationViewModel.unreadCount.collectAsState()
    val sessionPlaybackViewModel: SessionPlaybackViewModel = viewModel()
    val analyticsViewModel: AnalyticsViewModel = viewModel()
    val auditViewModel: AuditViewModel = viewModel()
    val organizationViewModel: OrganizationViewModel = viewModel()
    val securityViewModel: SecurityViewModel = viewModel()
    val billingViewModel: BillingViewModel = viewModel()
    val p2pViewModel: P2PViewModel = viewModel()
    val billingSubscription by billingViewModel.subscription.collectAsState()
    val currentPlan = billingSubscription?.plan ?: "free"

    LaunchedEffect(Unit) { billingViewModel.fetchAll() }

    var showDebug by remember { mutableStateOf(false) }
    var showSettingsOverflow by remember { mutableStateOf(false) }
    var showGetStarted by remember { mutableStateOf(!viewModel.hasCompletedOnboarding()) }
    var isLocked by remember { mutableStateOf(viewModel.isPinSet()) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var showCommandPalette by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val biometricService = remember { app.novossh.android.Services.BiometricAuthService(context) }
    val lifecycleOwner = LocalLifecycleOwner.current

    // Check biometric lock setting
    val biometricLock by viewModel.settings.collectAsState()

    // Lock app when biometric or PIN lock is enabled and app resumes from background
    DisposableEffect(biometricLock.biometricLock) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && (biometricLock.biometricLock || viewModel.isPinSet())) {
                isLocked = true
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (isLocked) {
        if (viewModel.isPinSet()) {
            PinLockScreen(
                onUnlock = { isLocked = false },
                validatePin = { viewModel.validatePin(it) },
            )
        } else {
            LockScreen(
                biometricService = biometricService,
                onUnlock = { isLocked = false },
            )
        }
        return
    }

    if (showDebug) {
        DebugLogScreen(onBack = { showDebug = false })
        return
    }

    if (showGetStarted) {
        GetStartedScreen(
            viewModel = viewModel,
            onDismiss = { showGetStarted = false },
        )
        return
    }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            if (!isTerminalOrSFTP) TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            currentScreen?.label ?: if (isTerminalOrSFTP) "" else "NovoSSH",
                            fontWeight = FontWeight.SemiBold,
                            color = Slate100,
                        )
                        if (isTerminalOrSFTP) {
                            Text(
                                " terminal",
                                fontWeight = FontWeight.Normal,
                                color = Slate500,
                                fontSize = 14.sp,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Slate400)
                    }
                },
                actions = {
                    // Search / Command Palette
                    IconButton(onClick = { showCommandPalette = true }) {
                        Icon(Icons.Default.Search, contentDescription = "Command palette", tint = Slate400)
                    }
                    // Notification bell
                    IconButton(onClick = {
                        navController.navigate(Screen.Notifications.route) {
                            launchSingleTop = true
                        }
                    }) {
                        BadgedBox(badge = {
                            if (unreadCount > 0) Badge { Text(if (unreadCount > 9) "9+" else "$unreadCount") }
                        }) {
                            Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = Slate400)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        },
        bottomBar = {
            if (!isTerminalOrSFTP) {
                NavigationBar(containerColor = Ink900, contentColor = Slate400) {
                    bottomNavItems.forEach { screen ->
                        NavigationBarItem(
                            icon = { Icon(screen.icon, contentDescription = screen.label) },
                            label = { Text(screen.label, fontSize = 11.sp) },
                            selected = currentScreen?.route == screen.route,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Neon,
                                selectedTextColor = Neon,
                                indicatorColor = Neon.copy(alpha = 0.1f),
                                unselectedIconColor = Slate500,
                                unselectedTextColor = Slate500,
                            ),
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet {
                    // Email verification banner
                    if (showVerificationBanner && authState.isAuthenticated) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = TerminalAmber.copy(alpha = 0.15f),
                        ) {
                            Row(
                                Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Default.Warning, null, tint = TerminalAmber, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text("Email not verified", color = TerminalAmber, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                    verificationMessage?.let {
                                        Text(it, color = Slate400, fontSize = 11.sp)
                                    }
                                }
                                TextButton(onClick = {
                                    authViewModel.resendVerificationEmail { success, error ->
                                        verificationMessage = if (success) "Verification email sent" else error
                                    }
                                }) {
                                    Text("Resend", color = TerminalAmber, fontSize = 12.sp)
                                }
                                IconButton(onClick = { showVerificationBanner = false }, modifier = Modifier.size(24.dp)) {
                                    Icon(Icons.Default.Close, "Dismiss", tint = Slate500, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                    Text(
                        "  NovoSSH",
                        modifier = Modifier.padding(top = 16.dp, start = 16.dp, bottom = 8.dp),
                        fontWeight = FontWeight.Bold,
                        color = Neon,
                        fontSize = 18.sp,
                    )
                    HorizontalDivider(color = Ink700)

                        val drawerExtras = listOf(
                            Screen.SFTP to "SFTP Browser",
                            Screen.History to "History",
                            Screen.PortForwarding to "Port Forwarding",
                            Screen.Sessions to "Sessions",
                            Screen.Analytics to "Analytics",
                            Screen.AuditLog to "Audit Log",
                            Screen.Organizations to "Organizations",
                            Screen.Security to "Security",
                            Screen.Billing to "Billing",
                            Screen.P2P to "P2P Sessions",
                            Screen.Notifications to "Notifications",
                        )
                        drawerExtras.forEach { (screen, label) ->
                            NavigationDrawerItem(
                                icon = { Icon(screen.icon, contentDescription = null, tint = Slate400) },
                                label = { Text(label, color = Slate200) },
                                selected = currentScreen?.route == screen.route,
                                onClick = {
                                    scope.launch { drawerState.close() }
                                    navController.navigate(screen.route) {
                                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = Neon.copy(alpha = 0.1f),
                                    unselectedContainerColor = Color.Transparent,
                                ),
                            )
                        }

                        HorizontalDivider(color = Ink700, modifier = Modifier.padding(vertical = 4.dp))

                        NavigationDrawerItem(
                            icon = { Icon(Icons.Default.Settings, contentDescription = null, tint = Slate400) },
                        label = { Text("Settings", color = Slate200) },
                        selected = currentScreen?.route == Screen.Settings.route,
                        onClick = {
                            scope.launch { drawerState.close() }
                            navController.navigate(Screen.Settings.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true; restoreState = true
                            }
                        },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                        colors = NavigationDrawerItemDefaults.colors(
                            selectedContainerColor = Neon.copy(alpha = 0.1f),
                            unselectedContainerColor = Color.Transparent,
                        ),
                    )
                    NavigationDrawerItem(
                        icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = TerminalRed) },
                        label = { Text("Sign Out", color = TerminalRed) },
                        selected = false,
                        onClick = {
                            scope.launch { drawerState.close() }
                            authViewModel.logout()
                        },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                        colors = NavigationDrawerItemDefaults.colors(
                            selectedContainerColor = TerminalRed.copy(alpha = 0.1f),
                            unselectedContainerColor = Color.Transparent,
                        ),
                    )
                }
            },
            gesturesEnabled = drawerState.isOpen,
        ) {
            NavHost(
                navController,
                startDestination = Screen.Hosts.route,
            ) {
                composable(Screen.Hosts.route) { HostsScreen(viewModel, navController) }
                composable(Screen.Vault.route) { VaultScreen(viewModel) }
                composable(
                    "terminal/{hostId}",
                    arguments = listOf(navArgument("hostId") { type = NavType.StringType })
                ) { back ->
                    val hostId = back.arguments?.getString("hostId") ?: return@composable
                    TerminalScreen(viewModel, hostId, navController)
                }
                composable(Screen.Snippets.route) { SnippetsScreen(viewModel) }
                composable(Screen.Keys.route) { KeysScreen(viewModel) }
                composable(Screen.SFTP.route) {
                    PaywallGate(currentPlan, Feature.SFTP_BROWSER, navController) {
                        SFTPBrowserScreen(viewModel, navController)
                    }
                }
                composable(
                    "sftp/{hostId}",
                    arguments = listOf(navArgument("hostId") { type = NavType.StringType })
                ) { back ->
                    val hostId = back.arguments?.getString("hostId") ?: return@composable
                    SFTPSessionScreen(viewModel, hostId, navController)
                }
                composable(Screen.History.route) { HistoryScreen(viewModel) }
                composable(Screen.PortForwarding.route) {
                    PaywallGate(currentPlan, Feature.PORT_FORWARDING, navController) {
                        PortForwardingListScreen(viewModel, navController)
                    }
                }
                composable(Screen.Settings.route) { SettingsScreen(viewModel, authViewModel, currentPlan = currentPlan, onOpenDebug = { showDebug = true }) }
                composable(Screen.Notifications.route) {
                    NotificationsScreen(
                        viewModel = notificationViewModel,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(Screen.Sessions.route) {
                    PaywallGate(currentPlan, Feature.SESSION_RECORDING, navController) {
                        SessionListScreen(viewModel = sessionPlaybackViewModel, navController = navController)
                    }
                }
                composable(
                    "session-playback/{sessionId}",
                    arguments = listOf(androidx.navigation.navArgument("sessionId") { type = NavType.StringType })
                ) { back ->
                    val sessionId = back.arguments?.getString("sessionId") ?: return@composable
                    PaywallGate(currentPlan, Feature.SESSION_RECORDING, navController) {
                        SessionPlaybackScreen(sessionId = sessionId, viewModel = sessionPlaybackViewModel, navController = navController)
                    }
                }
                composable(Screen.Analytics.route) {
                    PaywallGate(currentPlan, Feature.ANALYTICS, navController) {
                        AnalyticsDashboardScreen(viewModel = analyticsViewModel, navController = navController)
                    }
                }
                composable(Screen.AuditLog.route) {
                    PaywallGate(currentPlan, Feature.AUDIT_LOGS, navController) {
                        AuditLogScreen(viewModel = auditViewModel, navController = navController)
                    }
                }
                composable(Screen.Organizations.route) {
                    PaywallGate(currentPlan, Feature.TEAMS, navController) {
                        OrganizationsScreen(viewModel = organizationViewModel, navController = navController)
                    }
                }
                composable(Screen.Security.route) {
                    PaywallGate(currentPlan, Feature.MFA, navController) {
                        SecuritySettingsScreen(viewModel = securityViewModel, navController = navController)
                    }
                }
                composable(Screen.Billing.route) {
                    BillingScreen(viewModel = billingViewModel, navController = navController)
                }
                composable(Screen.P2P.route) {
                    PaywallGate(currentPlan, Feature.P2P_SYNC, navController) {
                        P2PScreen(viewModel = p2pViewModel, navController = navController)
                    }
                }
                composable(
                    "org-detail/{orgId}/{orgName}",
                    arguments = listOf(
                        androidx.navigation.navArgument("orgId") { type = NavType.StringType },
                        androidx.navigation.navArgument("orgName") { type = NavType.StringType },
                    )
                ) { back ->
                    val orgId = back.arguments?.getString("orgId") ?: return@composable
                    val orgName = back.arguments?.getString("orgName") ?: ""
                    OrgDetailScreen(orgId = orgId, orgName = orgName, viewModel = organizationViewModel, navController = navController)
                }
            }

            if (showCommandPalette) {
                val hosts by viewModel.hosts.collectAsState()
                CommandPaletteSheet(
                    hosts = hosts,
                    onDismiss = { showCommandPalette = false },
                    onConnectHost = { host ->
                        navController.navigate("terminal/${host.id}") { launchSingleTop = true }
                    },
                    onOpenSFTP = {
                        navController.navigate(Screen.SFTP.route) { launchSingleTop = true }
                    },
                    onOpenPortForwarding = {
                        navController.navigate(Screen.PortForwarding.route) { launchSingleTop = true }
                    },
                )
            }
        }
    }
}
