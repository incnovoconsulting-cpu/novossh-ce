package app.novossh.android.billing

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.ui.navigation.Screen
import app.novossh.android.ui.theme.*

/**
 * Wraps content that requires a specific plan.
 * Shows an upgrade prompt when the user's plan is insufficient.
 */
@Composable
fun PaywallGate(
    currentPlan: String,
    feature: Feature,
    navController: NavController,
    content: @Composable () -> Unit,
) {
    if (canAccess(currentPlan, feature)) {
        content()
    } else {
        PaywallPrompt(feature = feature, navController = navController)
    }
}

@Composable
fun PaywallPrompt(
    feature: Feature,
    navController: NavController,
) {
    val required = requiredPlanFor(feature)
    val planColor = if (required == "pro") Color(0xFFa855f7) else Neon

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(32.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = planColor.copy(alpha = 0.12f),
                modifier = Modifier.size(72.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Lock, null, tint = planColor, modifier = Modifier.size(32.dp))
                }
            }

            Text(
                text = featureDisplayName(feature),
                color = Slate100,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "This feature requires the ${required.replaceFirstChar { it.uppercase() }} plan or higher.",
                color = Slate400,
                fontSize = 14.sp,
            )

            Button(
                onClick = { navController.navigate(Screen.Billing.route) },
                colors = ButtonDefaults.buttonColors(containerColor = planColor, contentColor = Ink950),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Upgrade to ${required.replaceFirstChar { it.uppercase() }}", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

private fun featureDisplayName(feature: Feature): String = when (feature) {
    Feature.PORT_FORWARDING  -> "Port Forwarding"
    Feature.SFTP_BROWSER     -> "SFTP Browser"
    Feature.COMMAND_PALETTE  -> "Command Palette"
    Feature.MFA              -> "MFA / Security Keys"
    Feature.ANALYTICS        -> "Analytics Dashboard"
    Feature.P2P_SYNC         -> "P2P Sync"
    Feature.SESSION_RECORDING -> "Session Recording"
    Feature.AUDIT_LOGS       -> "Audit Logs"
    Feature.TEAMS            -> "Teams"
    Feature.UNLIMITED_HOSTS  -> "Unlimited HostS"
    Feature.UNLIMITED_VAULTS -> "Unlimited Vaults"
    Feature.UNLIMITED_KEYS   -> "Unlimited Keys"
    Feature.UNLIMITED_TABS   -> "Unlimited Tabs"
}
