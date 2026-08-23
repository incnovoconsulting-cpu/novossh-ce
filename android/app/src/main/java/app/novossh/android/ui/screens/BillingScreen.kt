package app.novossh.android.ui.screens

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import app.novossh.android.billing.IAPProductDetails
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.BillingViewModel
import app.novossh.android.viewmodel.QuotaStatus
import app.novossh.android.viewmodel.Subscription
import kotlinx.coroutines.launch

private data class PlanDef(
    val id: String,
    val name: String,
    val fallbackMonthly: String,
    val fallbackAnnual: String,
    val features: List<String>,
    val limitations: List<String>,
    val accentColor: Color,
)

private val plans = listOf(
    PlanDef(
        "free", "Free", "$0", "$0",
        features = listOf("3 hosts", "10 snippets", "1 vault", "2 SSH keys", "2 tabs"),
        limitations = listOf("No port forwarding", "No SFTP browser", "No MFA"),
        accentColor = Color(0xFF64748b),
    ),
    PlanDef(
        "starter", "Starter", "$4.99", "$3.33",
        features = listOf("25 hosts", "Unlimited snippets, vaults & keys", "10 tabs",
                          "Port forwarding", "SFTP browser", "MFA / security keys",
                          "Analytics", "Command palette"),
        limitations = listOf("No session recording", "No P2P sync"),
        accentColor = Color(0xFF39ff14),
    ),
    PlanDef(
        "pro", "Pro", "$9.99", "$6.67",
        features = listOf("Unlimited hosts & tabs", "Session recording & playback",
                          "Audit logs", "P2P sync", "Priority support", "Everything in Starter"),
        limitations = emptyList(),
        accentColor = Color(0xFFa855f7),
    ),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(viewModel: BillingViewModel, navController: NavController) {
    val subscription by viewModel.subscription.collectAsState()
    val quotas by viewModel.quotas.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val iapError by viewModel.playBilling.error.collectAsState()
    val iapProducts by viewModel.iapProducts.collectAsState()
    val isPlayPurchasing by viewModel.isPlayPurchasing.collectAsState()
    val checkoutFallbackUrl by viewModel.checkoutFallbackUrl.collectAsState()
    var billingCycle by remember { mutableStateOf("monthly") }
    var isOpening by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun openUrl(url: String?) {
        if (url != null) context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        isOpening = false
    }

    // Handle Stripe fallback URL (when Play products not available)
    LaunchedEffect(checkoutFallbackUrl) {
        checkoutFallbackUrl?.let { url ->
            openUrl(url)
            viewModel.consumeFallbackUrl()
        }
    }

    LaunchedEffect(Unit) { viewModel.fetchAll() }

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { Text("Billing & Plans", color = Slate100, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        }
    ) { padding ->
        if (isLoading && subscription == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Neon)
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Current plan banner
                subscription?.let { sub ->
                    item { PlanBannerCard(sub = sub, isOpening = isOpening, onManage = {
                        isOpening = true
                        scope.launch { openUrl(viewModel.getPortalUrl()) }
                    }) }
                }

                // Billing cycle toggle
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf("monthly" to "Monthly", "annual" to "Annual (–20%)").forEach { (key, label) ->
                            FilterChip(
                                selected = billingCycle == key,
                                onClick = { billingCycle = key },
                                label = { Text(label, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Neon.copy(alpha = 0.15f),
                                    selectedLabelColor = Neon,
                                    containerColor = Ink800,
                                    labelColor = Slate400,
                                ),
                            )
                        }
                    }
                }

                // Plan cards
                items(plans.size) { idx ->
                    val plan = plans[idx]
                    val isCurrent = plan.id == (subscription?.plan ?: "free")
                    PlanCard(
                        plan = plan,
                        billingCycle = billingCycle,
                        isCurrent = isCurrent,
                        iapProducts = iapProducts,
                        isOpening = isOpening || isPlayPurchasing,
                        onSelect = {
                            val activity = context as? Activity
                            if (activity != null) {
                                viewModel.launchPurchase(activity, plan.id, billingCycle)
                            } else {
                                isOpening = true
                                scope.launch { openUrl(viewModel.getCheckoutUrl(plan.id, billingCycle)) }
                            }
                        },
                    )
                }

                // Restore purchases
                item {
                    TextButton(
                        onClick = { /* Google Play handles restore automatically via subscription state */ },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Restore Purchases", color = Slate400, fontSize = 12.sp)
                    }
                }

                // Promo code
                item {
                    val context = LocalContext.current
                    TextButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/details?id=app.novossh.android"))
                            context.startActivity(intent)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Have a promo code?", color = Slate400, fontSize = 12.sp)
                    }
                }

                // Usage section
                if (quotas.isNotEmpty()) {
                    item { UsageSectionCard(quotas = quotas) }
                }
            }
        }
    }

    (error ?: iapError)?.let { msg ->
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            containerColor = Ink800,
            title = { Text("Error", color = Slate100) },
            text = { Text(msg, color = Slate400) },
            confirmButton = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Neon) } },
        )
    }
}

@Composable
private fun PlanBannerCard(sub: Subscription, isOpening: Boolean, onManage: () -> Unit) {
    val planColor = when (sub.plan) {
        "pro" -> Color(0xFFa855f7)
        "starter" -> Neon
        else -> Slate500
    }
    val statusColor = when (sub.status) {
        "active" -> Color(0xFF22c55e)
        "past_due" -> Color(0xFFf97316)
        else -> Color(0xFFef4444)
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Current Plan", color = Slate500, fontSize = 11.sp)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(sub.plan.replaceFirstChar { it.uppercase() }, color = planColor, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Surface(shape = RoundedCornerShape(50), color = statusColor.copy(alpha = 0.12f)) {
                        Text(
                            sub.status.replace("_", " "),
                            color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                        )
                    }
                }
            }
            if (sub.plan != "free") {
                OutlinedButton(
                    onClick = onManage,
                    enabled = !isOpening,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Neon),
                    border = ButtonDefaults.outlinedButtonBorder.copy(width = 1.dp),
                ) {
                    if (isOpening) CircularProgressIndicator(Modifier.size(14.dp), color = Neon, strokeWidth = 2.dp)
                    else Text("Manage", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: PlanDef,
    billingCycle: String,
    isCurrent: Boolean,
    iapProducts: List<IAPProductDetails>,
    isOpening: Boolean,
    onSelect: () -> Unit,
) {
    // Prefer Play Store price; fall back to hardcoded strings
    val productSuffix = if (billingCycle == "annual") "_annual" else "_monthly"
    val productId = "novossh_${plan.id}${productSuffix}"
    val iapPrice = iapProducts.firstOrNull { it.productId == productId }?.price
    val price = iapPrice?.ifEmpty { null }
        ?: (if (billingCycle == "annual") plan.fallbackAnnual else plan.fallbackMonthly)

    val borderColor = if (isCurrent) plan.accentColor.copy(alpha = 0.4f) else Color.Transparent

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrent) plan.accentColor.copy(alpha = 0.06f) else Ink800,
        ),
        border = if (isCurrent) androidx.compose.foundation.BorderStroke(1.5.dp, borderColor) else null,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(plan.name, color = Slate100, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(price, color = plan.accentColor, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        if (plan.id != "free") Text("/mo", color = Slate500, fontSize = 12.sp, modifier = Modifier.padding(bottom = 3.dp))
                    }
                }
                if (isCurrent) {
                    Surface(shape = RoundedCornerShape(50), color = plan.accentColor.copy(alpha = 0.12f)) {
                        Text(
                            "Current", color = plan.accentColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
            }

            HorizontalDivider(color = Ink700)

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                plan.features.forEach { feature ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, null, tint = plan.accentColor, modifier = Modifier.size(14.dp))
                        Text(feature, color = Slate300, fontSize = 13.sp)
                    }
                }
                plan.limitations.forEach { limitation ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Cancel, null, tint = Slate600, modifier = Modifier.size(14.dp))
                        Text(limitation, color = Slate600, fontSize = 13.sp)
                    }
                }
            }

            if (!isCurrent && plan.id != "free") {
                Button(
                    onClick = onSelect,
                    enabled = !isOpening,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = plan.accentColor, contentColor = Ink950),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    if (isOpening) CircularProgressIndicator(Modifier.size(16.dp), color = Ink950, strokeWidth = 2.dp)
                    else Text("Upgrade to ${plan.name}", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun UsageSectionCard(quotas: List<QuotaStatus>) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Ink800),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Default.Speed, null, tint = Neon, modifier = Modifier.size(16.dp))
                Text("Resource Usage", color = Slate100, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
            quotas.sortedByDescending { it.usagePercent }.forEach { quota ->
                UsageRow(quota = quota)
            }
        }
    }
}

private val resourceTypeLabels = mapOf(
    "api_calls" to "API Calls",
    "storage_bytes" to "Storage",
    "session_minutes" to "Session Minutes",
    "sftp_bytes" to "SFTP Storage",
)

private fun formatResourceLabel(resourceType: String): String =
    resourceTypeLabels[resourceType] ?: resourceType.split("_").joinToString(" ") { it.replaceFirstChar(Char::uppercase) }

private fun formatQuotaValue(context: android.content.Context, resourceType: String, value: Long): String =
    if (resourceType.endsWith("_bytes")) android.text.format.Formatter.formatShortFileSize(context, value)
    else value.toString()

@Composable
private fun UsageRow(quota: QuotaStatus) {
    val context = LocalContext.current
    val barColor = when (quota.status) {
        "critical" -> Color(0xFFef4444)
        "warning" -> Color(0xFFf97316)
        else -> Neon
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatResourceLabel(quota.resourceType), color = Slate300, fontSize = 13.sp)
            Text(
                "${formatQuotaValue(context, quota.resourceType, quota.currentUsage)} / ${formatQuotaValue(context, quota.resourceType, quota.hardLimit)}",
                color = Slate500, fontSize = 12.sp,
            )
        }
        LinearProgressIndicator(
            progress = { (quota.usagePercent / 100).toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(5.dp),
            color = barColor,
            trackColor = barColor.copy(alpha = 0.12f),
        )
    }
}
