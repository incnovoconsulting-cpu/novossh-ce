package app.novossh.android.Services

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricAuthService(private val context: Context) {

    enum class Status {
        AVAILABLE,
        NOT_AVAILABLE,
        HARDWARE_UNAVAILABLE,
        NONE_ENROLLED,
    }

    fun checkBiometricStatus(): Status {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
            BiometricManager.BIOMETRIC_SUCCESS -> Status.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> Status.HARDWARE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> Status.NONE_ENROLLED
            else -> Status.NOT_AVAILABLE
        }
    }

    fun authenticate(
        activity: FragmentActivity,
        title: String = "Unlock NovoSSH",
        subtitle: String = "Authenticate to access your SSH credentials",
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit = {},
    ) {
        val executor = ContextCompat.getMainExecutor(context)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onError(errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                onFailed()
            }
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .setNegativeButtonText("Cancel")
            .build()

        BiometricPrompt(activity, executor, callback).authenticate(promptInfo)
    }
}
