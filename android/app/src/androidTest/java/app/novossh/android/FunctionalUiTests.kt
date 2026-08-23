package app.novossh.android

import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.navigation.compose.rememberNavController
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import app.novossh.android.ui.screens.*
import app.novossh.android.ui.theme.NovoSSHTheme
import app.novossh.android.viewmodel.*
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FunctionalUiTests {
    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var appViewModel: AppViewModel
    private lateinit var authViewModel: AuthViewModel
    private lateinit var billingViewModel: BillingViewModel
    private lateinit var notificationViewModel: NotificationViewModel
    private lateinit var analyticsViewModel: AnalyticsViewModel
    private lateinit var auditViewModel: AuditViewModel
    private lateinit var organizationViewModel: OrganizationViewModel
    private lateinit var securityViewModel: SecurityViewModel
    private lateinit var p2pViewModel: P2PViewModel

    @Before
    fun setup() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NovoSSHApp
        appViewModel = AppViewModel(appContext)
        authViewModel = AuthViewModel(appContext)
        billingViewModel = BillingViewModel(appContext)
        notificationViewModel = NotificationViewModel(appContext)
        analyticsViewModel = AnalyticsViewModel(appContext)
        auditViewModel = AuditViewModel(appContext)
        organizationViewModel = OrganizationViewModel(appContext)
        securityViewModel = SecurityViewModel(appContext)
        p2pViewModel = P2PViewModel(appContext)
        authViewModel.loginWithToken("test-token", 3600) { _, _ -> }
    }

    @After
    fun cleanup() {
        appViewModel.hosts.value.forEach { appViewModel.deleteHost(it.id) }
        appViewModel.keys.value.forEach { appViewModel.deleteKey(it.id) }
        appViewModel.snippets.value.forEach { appViewModel.deleteSnippet(it.id) }
    }

    // ── Hosts ──────────────────────────────────────────────

    @Test
    fun hostsScreen_emptyStateAndAddHost() {
        composeTestRule.setContent {
            NovoSSHTheme { HostsScreen(viewModel = appViewModel, navController = rememberNavController()) }
        }
        composeTestRule.onNodeWithText("No hosts yet").assertExists()
        composeTestRule.onNode(hasContentDescription("Add host")).performClick()
        composeTestRule.onNodeWithText("Label").performTextInput("test-host")
        composeTestRule.onNodeWithText("Address").performTextInput("192.168.1.100")
        composeTestRule.onNodeWithText("Username").performTextInput("root")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("test-host").assertExists()
        composeTestRule.onNodeWithText("root@192.168.1.100:22").assertExists()
    }

    @Test
    fun hostsScreen_multipleHosts() {
        composeTestRule.setContent {
            NovoSSHTheme { HostsScreen(viewModel = appViewModel, navController = rememberNavController()) }
        }
        // Add first host
        composeTestRule.onNode(hasContentDescription("Add host")).performClick()
        composeTestRule.onNodeWithText("Label").performTextInput("web-server")
        composeTestRule.onNodeWithText("Address").performTextInput("10.0.0.1")
        composeTestRule.onNodeWithText("Username").performTextInput("admin")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("web-server").assertExists()

        // Add second host
        composeTestRule.onNode(hasContentDescription("Add host")).performClick()
        composeTestRule.onNodeWithText("Label").performTextInput("db-server")
        composeTestRule.onNodeWithText("Address").performTextInput("10.0.0.2")
        composeTestRule.onNodeWithText("Username").performTextInput("root")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("db-server").assertExists()
    }

    @Test
    fun hostsScreen_validationRequired() {
        composeTestRule.setContent {
            NovoSSHTheme { HostsScreen(viewModel = appViewModel, navController = rememberNavController()) }
        }
        composeTestRule.onNode(hasContentDescription("Add host")).performClick()
        // Try saving without required fields
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("Address is required").assertExists()
        composeTestRule.onNodeWithText("Username is required").assertExists()
    }

    // ── Settings ───────────────────────────────────────────

    @Test
    fun settingsScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { SettingsScreen(viewModel = appViewModel, authViewModel = authViewModel) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Account").assertExists()
    }

    @Test
    fun settingsScreen_biometricToggle() {
        composeTestRule.setContent {
            NovoSSHTheme { SettingsScreen(viewModel = appViewModel, authViewModel = authViewModel) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Biometric Lock").assertExists()
    }

    @Test
    fun settingsScreen_aboutSection() {
        composeTestRule.setContent {
            NovoSSHTheme { SettingsScreen(viewModel = appViewModel, authViewModel = authViewModel) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("About").assertExists()
    }

    // ── Billing ────────────────────────────────────────────

    @Test
    fun billingScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { BillingScreen(viewModel = billingViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── Keys ───────────────────────────────────────────────

    @Test
    fun keysScreen_addAndDeleteKey() {
        composeTestRule.setContent {
            NovoSSHTheme { KeysScreen(viewModel = appViewModel) }
        }
        composeTestRule.onNodeWithText("No SSH keys").assertExists()
        composeTestRule.onNode(hasContentDescription("Add")).performClick()
        composeTestRule.onNodeWithText("Add SSH key").assertExists()
        composeTestRule.onNodeWithText("Label").performTextInput("my-key")
        composeTestRule.onNodeWithText("Private Key (PEM)").performTextInput("[REDACTED PRIVATE KEY]")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("my-key").assertExists()
    }

    // ── Snippets ───────────────────────────────────────────

    @Test
    fun snippetsScreen_emptyStateAndAddSnippet() {
        composeTestRule.setContent {
            NovoSSHTheme { SnippetsScreen(viewModel = appViewModel) }
        }
        composeTestRule.onNodeWithText("No snippets yet").assertExists()
        composeTestRule.onNode(hasContentDescription("Add")).performClick()
        composeTestRule.onNodeWithText("Add snippet").assertExists()
        composeTestRule.onNodeWithText("Label").performTextInput("list-files")
        composeTestRule.onNodeWithText("Command").performTextInput("ls -la")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("ls -la").assertExists()
    }

    // ── Notifications ──────────────────────────────────────

    @Test
    fun notificationsScreen_emptyState() {
        composeTestRule.setContent {
            NovoSSHTheme { NotificationsScreen(viewModel = notificationViewModel, onBack = {}) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── Organizations ──────────────────────────────────────

    @Test
    fun organizationsScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { OrganizationsScreen(viewModel = organizationViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── Security ───────────────────────────────────────────

    @Test
    fun securityScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { SecuritySettingsScreen(viewModel = securityViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── P2P ────────────────────────────────────────────────

    @Test
    fun p2pScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { P2PScreen(viewModel = p2pViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── Analytics ──────────────────────────────────────────

    @Test
    fun analyticsScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { AnalyticsDashboardScreen(viewModel = analyticsViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }

    // ── Audit Log ──────────────────────────────────────────

    @Test
    fun auditLogScreen_renders() {
        composeTestRule.setContent {
            NovoSSHTheme { AuditLogScreen(viewModel = auditViewModel, navController = rememberNavController()) }
        }
        composeTestRule.waitForIdle()
        composeTestRule.waitForIdle()
    }
}
