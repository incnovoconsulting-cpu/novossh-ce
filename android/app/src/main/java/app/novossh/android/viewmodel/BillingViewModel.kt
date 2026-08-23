package app.novossh.android.viewmodel

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import app.novossh.android.billing.IAPProductDetails
import app.novossh.android.billing.PlayBillingService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Subscription(
    val plan: String,      // "free" | "starter" | "pro"
    val status: String,    // "active" | "past_due" | "canceled"
    val usage: Map<String, Int>,
)

data class QuotaStatus(
    val resourceType: String,
    val currentUsage: Long,
    val hardLimit: Long,
    val usagePercent: Double,
    val exceeded: Boolean,
    val status: String,   // "ok" | "warning" | "critical"
)

class BillingViewModel(app: Application) : AndroidViewModel(app) {
    private val secure = SecureStorage(app)

    private val _subscription = MutableStateFlow<Subscription?>(null)
    val subscription: StateFlow<Subscription?> = _subscription

    private val _quotas = MutableStateFlow<List<QuotaStatus>>(emptyList())
    val quotas: StateFlow<List<QuotaStatus>> = _quotas

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    // Play Billing
    val playBilling = PlayBillingService(
        context = app,
        scope = viewModelScope,
        getToken = { secure.get("auth_token") },
        getBaseUrl = { secure.get("api_base_url") ?: "https://ssh.novossh.com:8787" },
        onPlanUpdated = { plan ->
            // Refresh subscription from server after Play purchase
            fetchAll()
        },
    )
    val iapProducts: StateFlow<List<IAPProductDetails>> = playBilling.products
    val isPlayPurchasing: StateFlow<Boolean> = playBilling.isPurchasing

    fun clearError() {
        _error.value = null
        playBilling.clearError()
    }

    fun fetchAll() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val subDeferred = async { fetchSubscription() }
                val usageDeferred = async { fetchUsage() }
                subDeferred.await()
                usageDeferred.await()
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun fetchSubscription() {
        try {
            val data = get("/api/billing/subscription")
            val obj = JSONObject(data)
            val usageObj = obj.getJSONObject("usage")
            val usage = mutableMapOf<String, Int>()
            usageObj.keys().forEach { key -> usage[key] = usageObj.optInt(key) }
            _subscription.value = Subscription(
                plan = obj.getString("plan"),
                status = obj.getString("status"),
                usage = usage,
            )
        } catch (e: Exception) {
            if (e.message?.contains("401") == true) {
                _error.value = "Session expired. Please sign out and sign back in."
            } else {
                _error.value = e.message
            }
        }
    }

    private suspend fun fetchUsage() {
        try {
            val data = get("/api/billing/usage/current")
            val obj = JSONObject(data)
            val arr = obj.getJSONArray("statuses")
            _quotas.value = (0 until arr.length()).map { i ->
                val s = arr.getJSONObject(i)
                QuotaStatus(
                    resourceType = s.getString("resourceType"),
                    currentUsage = s.getLong("currentUsage"),
                    hardLimit = s.getLong("hardLimit"),
                    usagePercent = s.getDouble("usagePercent"),
                    exceeded = s.getBoolean("exceeded"),
                    status = s.getString("status"),
                )
            }
        } catch (_: Exception) {}
    }

    // Try Play Billing first; falls back to Stripe web checkout
    fun launchPurchase(activity: Activity, planId: String, billingCycle: String) {
        val productSuffix = if (billingCycle == "annual") "_annual" else "_monthly"
        val productId = "novossh_${planId}${productSuffix}"
        val offer = playBilling.products.value.firstOrNull { it.productId == productId }
        if (offer != null) {
            playBilling.launchPurchase(activity, productId, offer.offerToken)
        } else {
            // Fall back to Stripe web checkout (handled in UI via getCheckoutUrl)
            viewModelScope.launch {
                val url = getCheckoutUrl(planId, billingCycle)
                _checkoutFallbackUrl.value = url
            }
        }
    }

    private val _checkoutFallbackUrl = MutableStateFlow<String?>(null)
    val checkoutFallbackUrl: StateFlow<String?> = _checkoutFallbackUrl.asStateFlow()
    fun consumeFallbackUrl() { _checkoutFallbackUrl.value = null }

    suspend fun getCheckoutUrl(plan: String, billing: String): String? {
        return try {
            val body = JSONObject().apply { put("plan", plan); put("billing", billing) }
            val data = post("/api/billing/create-checkout-session", body)
            JSONObject(data).optString("url").ifEmpty { null }
        } catch (e: Exception) {
            _error.value = e.message; null
        }
    }

    suspend fun getPortalUrl(): String? {
        return try {
            val data = post("/api/billing/create-portal-session", JSONObject())
            JSONObject(data).optString("url").ifEmpty { null }
        } catch (e: Exception) {
            _error.value = e.message; null
        }
    }

    private fun baseUrl() = secure.get("api_base_url") ?: "https://ssh.novossh.com:8787"
    private fun token() = secure.get("auth_token") ?: ""

    private suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        if (conn.responseCode == 401) {
            conn.disconnect()
            throw Exception("HTTP 401: Session expired")
        }
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun post(path: String, body: JSONObject): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.outputStream.write(body.toString().toByteArray())
        if (conn.responseCode == 401) {
            conn.disconnect()
            throw Exception("HTTP 401: Session expired")
        }
        conn.inputStream.bufferedReader().readText()
    }
}
