package app.novossh.android.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// Product IDs must match what you configure in Google Play Console.
// These are subscription product IDs (not one-time purchases).
object IAPProduct {
    const val STARTER_MONTHLY = "novossh_starter_monthly"
    const val STARTER_ANNUAL  = "novossh_starter_annual"
    const val PRO_MONTHLY     = "novossh_pro_monthly"
    const val PRO_ANNUAL      = "novossh_pro_annual"

    val all = listOf(STARTER_MONTHLY, STARTER_ANNUAL, PRO_MONTHLY, PRO_ANNUAL)

    fun planFor(productId: String): String = when {
        productId.startsWith("novossh_starter") -> "starter"
        productId.startsWith("novossh_pro")     -> "pro"
        else -> "free"
    }
}

data class IAPProductDetails(
    val productId: String,
    val title: String,
    val price: String,
    val offerToken: String?,
)

class PlayBillingService(
    context: Context,
    private val scope: CoroutineScope,
    private val getToken: () -> String?,
    private val getBaseUrl: () -> String,
    private val onPlanUpdated: (String) -> Unit,
) : PurchasesUpdatedListener {

    private val _products = MutableStateFlow<List<IAPProductDetails>>(emptyList())
    val products: StateFlow<List<IAPProductDetails>> = _products

    private val _isPurchasing = MutableStateFlow(false)
    val isPurchasing: StateFlow<Boolean> = _isPurchasing

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun clearError() { _error.value = null }

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    init {
        connect()
    }

    private fun connect() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    scope.launch { queryProducts() }
                    scope.launch { handleExistingPurchases() }
                }
            }
            override fun onBillingServiceDisconnected() {
                // BillingClient handles reconnect on next operation
            }
        })
    }

    private suspend fun queryProducts() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(IAPProduct.all.map { id ->
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            })
            .build()

        val result = billingClient.queryProductDetails(params)
        if (result.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            _products.value = (result.productDetailsList ?: emptyList()).flatMap { detail ->
                detail.subscriptionOfferDetails?.map { offer ->
                    IAPProductDetails(
                        productId = detail.productId,
                        title = detail.title,
                        price = offer.pricingPhases.pricingPhaseList.firstOrNull()?.formattedPrice ?: "",
                        offerToken = offer.offerToken,
                    )
                } ?: listOf(
                    IAPProductDetails(
                        productId = detail.productId,
                        title = detail.title,
                        price = "",
                        offerToken = null,
                    )
                )
            }
        }
    }

    private suspend fun handleExistingPurchases() {
        val result = billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )
        result.purchasesList.forEach { purchase ->
            if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                acknowledgePurchase(purchase)
                reportToServer(purchase)
            }
        }
    }

    fun launchPurchase(activity: Activity, productId: String, offerToken: String?) {
        val productDetail = billingClient.let { client ->
            // We need to re-query synchronously here — use cached products list
            _products.value.firstOrNull { it.productId == productId }
        } ?: run { _error.value = "Product not found"; return }

        // We need the actual ProductDetails object from a fresh query
        scope.launch {
            _isPurchasing.value = true
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                ))
                .build()

            val queryResult = billingClient.queryProductDetails(params)
            val details = queryResult.productDetailsList?.firstOrNull()
            if (details == null) {
                _isPurchasing.value = false
                _error.value = "Product details unavailable"
                return@launch
            }

            val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
            val productParamsList = listOf(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .apply { if (offerToken != null) setOfferToken(offerToken) }
                    .build()
            )
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productParamsList)
                .build()
            billingClient.launchBillingFlow(activity, flowParams)
            // Result delivered via onPurchasesUpdated
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        _isPurchasing.value = false
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        scope.launch {
                            acknowledgePurchase(purchase)
                            reportToServer(purchase)
                        }
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> { /* user cancelled — no error */ }
            else -> { _error.value = "Purchase failed (${result.responseCode}): ${result.debugMessage}" }
        }
    }

    private suspend fun acknowledgePurchase(purchase: Purchase) {
        if (purchase.isAcknowledged) return
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient.acknowledgePurchase(params)
    }

    private suspend fun reportToServer(purchase: Purchase) {
        val productId = purchase.products.firstOrNull() ?: return
        try {
            val body = JSONObject().apply {
                put("purchaseToken", purchase.purchaseToken)
                put("productId", productId)
                put("packageName", "app.novossh.android")
            }
            val data = post("/api/billing/google/verify", body)
            val plan = JSONObject(data).optString("plan", "")
            if (plan.isNotEmpty()) onPlanUpdated(plan)
        } catch (e: Exception) {
            _error.value = "Server verification failed: ${e.message}"
        }
    }

    private suspend fun post(path: String, body: JSONObject): String = withContext(Dispatchers.IO) {
        val conn = URL(getBaseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${getToken() ?: ""}")
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }
}
