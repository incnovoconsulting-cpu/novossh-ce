package app.novossh.android

import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.novossh.android.ui.screens.LoginScreen
import app.novossh.android.viewmodel.AuthViewModel
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LoginScreenUiTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var authViewModel: AuthViewModel

    @Before
    fun setup() {
        val appContext = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NovoSSHApp
        authViewModel = AuthViewModel(appContext)
    }

    @Test
    fun loginScreen_showsNovoSSHTitle() {
        composeTestRule.setContent {
            LoginScreen(
                authViewModel = authViewModel,
                onLoginSuccess = {},
                onSwitchToSignup = {},
                onOpenDebug = {},
            )
        }
        composeTestRule.onNodeWithText("NovoSSH").assertExists()
        composeTestRule.onNodeWithText("Sign in").assertExists()
    }
}
