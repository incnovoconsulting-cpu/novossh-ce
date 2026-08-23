package app.novossh.android

import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import app.novossh.android.ui.navigation.AppNavigation
import app.novossh.android.ui.screens.HostsScreen
import app.novossh.android.ui.screens.KeysScreen
import app.novossh.android.ui.screens.SettingsScreen
import app.novossh.android.ui.screens.SnippetsScreen
import app.novossh.android.ui.theme.NovoSSHTheme
import app.novossh.android.viewmodel.AppViewModel
import app.novossh.android.viewmodel.AuthViewModel
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EndToEndUiTests {
    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var appViewModel: AppViewModel
    private lateinit var authViewModel: AuthViewModel

    @Before
    fun setup() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NovoSSHApp
        appViewModel = AppViewModel(appContext)
        authViewModel = AuthViewModel(appContext)
        appViewModel.completeOnboarding()
        authViewModel.loginWithToken("test-e2e-token", 3600) { _, _ -> }
    }

    @After
    fun cleanup() {
        val hosts = appViewModel.hosts.value
        hosts.forEach { appViewModel.deleteHost(it.id) }
        val keys = appViewModel.keys.value
        keys.forEach { appViewModel.deleteKey(it.id) }
        val snippets = appViewModel.snippets.value
        snippets.forEach { appViewModel.deleteSnippet(it.id) }
    }

    @Test
    fun authFlow_loginAndSignupScreens() {
        authViewModel.logout()

        composeTestRule.setContent {
            NovoSSHTheme {
                AppNavigation(viewModel = appViewModel, authViewModel = authViewModel)
            }
        }

        composeTestRule.onNodeWithText("NovoSSH").assertExists()
        composeTestRule.onNodeWithText("secure terminal client").assertExists()
        composeTestRule.onNodeWithText("Email").assertExists()
        composeTestRule.onNodeWithText("Password").assertExists()

        composeTestRule.onNodeWithText("create one").performClick()
        composeTestRule.onNodeWithText("Create account").assertExists()

        composeTestRule.onNodeWithText("sign in").performClick()
        composeTestRule.onNodeWithText("Sign in").assertExists()
    }

    @Test
    fun appFlow_hostsAndSettingsThroughAppNavigation() {
        composeTestRule.setContent {
            NovoSSHTheme {
                AppNavigation(viewModel = appViewModel, authViewModel = authViewModel)
            }
        }

        // Hosts screen renders by default
        composeTestRule.onNodeWithText("No hosts yet").assertExists()

        // Add a host
        composeTestRule.onNode(hasContentDescription("Add host")).performClick()
        composeTestRule.onNodeWithText("Label").performTextInput("e2e-host")
        composeTestRule.onNodeWithText("Address").performTextInput("10.0.0.1")
        composeTestRule.onNodeWithText("Username").performTextInput("admin")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("e2e-host").assertExists()

        // Navigate to Settings via overflow menu
        composeTestRule.onNode(hasContentDescription("Menu")).performClick()
        composeTestRule.onNodeWithText("Settings").performClick()
        composeTestRule.onNodeWithText("Font size: 14sp").performScrollTo()
        appViewModel.updateSettings(appViewModel.settings.value.copy(fontSize = 20))
        composeTestRule.onNodeWithText("Font size: 20sp").assertExists()
    }

    @Test
    fun keysScreen_addKeyWithinApp() {
        composeTestRule.setContent {
            NovoSSHTheme {
                KeysScreen(viewModel = appViewModel)
            }
        }

        composeTestRule.onNodeWithText("No SSH keys").assertExists()
        composeTestRule.onNode(hasContentDescription("Add")).performClick()
        composeTestRule.onNodeWithText("Add SSH key").assertExists()
        composeTestRule.onNodeWithText("Label").performTextInput("e2e-key")
        composeTestRule.onNodeWithText("Private Key (PEM)").performTextInput("[REDACTED PRIVATE KEY]")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("e2e-key").assertExists()
    }

    @Test
    fun snippetsScreen_addSnippetWithinApp() {
        composeTestRule.setContent {
            NovoSSHTheme {
                SnippetsScreen(viewModel = appViewModel)
            }
        }

        composeTestRule.onNodeWithText("No snippets yet").assertExists()
        composeTestRule.onNode(hasContentDescription("Add")).performClick()
        composeTestRule.onNodeWithText("Add snippet").assertExists()
        composeTestRule.onNodeWithText("Label").performTextInput("e2e-snippet")
        composeTestRule.onNodeWithText("Command").performTextInput("uname -a")
        composeTestRule.onNodeWithText("Save").performClick()
        composeTestRule.onNodeWithText("uname -a").assertExists()
    }
}
