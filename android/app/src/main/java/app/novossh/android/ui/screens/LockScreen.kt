package app.novossh.android.ui.screens

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import app.novossh.android.Services.BiometricAuthService
import app.novossh.android.ui.theme.*

@Composable
fun LockScreen(
    biometricService: BiometricAuthService,
    onUnlock: () -> Unit,
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    var error by remember { mutableStateOf<String?>(null) }
    var authenticating by remember { mutableStateOf(false) }
    val biometricStatus = remember { biometricService.checkBiometricStatus() }

    LaunchedEffect(Unit) {
        if (biometricStatus == BiometricAuthService.Status.AVAILABLE && activity != null) {
            authenticating = true
            biometricService.authenticate(
                activity = activity,
                onSuccess = {
                    authenticating = false
                    onUnlock()
                },
                onError = { err ->
                    authenticating = false
                    error = err
                },
                onFailed = {
                    error = "Fingerprint not recognized"
                },
            )
        } else if (biometricStatus != BiometricAuthService.Status.AVAILABLE) {
            onUnlock()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink950),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(Neon.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Fingerprint,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp),
                    tint = Neon,
                )
            }

            Spacer(Modifier.height(24.dp))

            Text(
                "NovoSSH",
                style = MaterialTheme.typography.headlineSmall,
                color = Slate100,
                fontWeight = FontWeight.Bold,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "Authenticate to unlock",
                style = MaterialTheme.typography.bodyMedium,
                color = Slate400,
            )

            Spacer(Modifier.height(24.dp))

            if (authenticating) {
                CircularProgressIndicator(color = Neon)
            } else if (error != null) {
                Text(
                    error!!,
                    color = TerminalRed,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        error = null
                        authenticating = true
                        activity?.let { act ->
                            biometricService.authenticate(
                                activity = act,
                                onSuccess = { authenticating = false; onUnlock() },
                                onError = { err -> authenticating = false; error = err },
                                onFailed = { error = "Fingerprint not recognized" },
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Neon, contentColor = Ink950),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Try Again")
                }
            } else {
                Text(
                    "Tap fingerprint sensor or use device unlock",
                    color = Slate500,
                    fontSize = 12.sp,
                )
            }
        }
    }
}
