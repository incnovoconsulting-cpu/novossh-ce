package app.novossh.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import app.novossh.android.ui.navigation.AppNavigation
import app.novossh.android.ui.theme.Ink950
import app.novossh.android.ui.theme.NovoSSHTheme
import app.novossh.android.viewmodel.AppViewModel
import app.novossh.android.viewmodel.AuthViewModel

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NovoSSHTheme {
                val vm: AppViewModel = viewModel()
                val authVm: AuthViewModel = viewModel()
                AppNavigation(viewModel = vm, authViewModel = authVm)
            }
        }
    }
}
