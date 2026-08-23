package app.novossh.android.tailscale

import android.content.Context
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Resolves the user's Headscale node IP after login.
 * Routing through the mesh is handled by the backend relay — this class
 * only fetches metadata so the app can inform connection decisions.
 */
class TailscaleManager(private val context: Context, private val secureStorage: SecureStorage) {

    private var nodeIP: String = ""

    /** Call after login — silently fetches the user's Headscale node IP. */
    suspend fun prepare(authToken: String) = withContext(Dispatchers.IO) {
        try {
            val base = secureStorage.get("api_base_url")?.trimEnd('/') ?: "https://ssh.novossh.com:8787"
            val conn = (URL("$base/api/tailscale/status").openConnection() as HttpURLConnection).apply {
                setRequestProperty("Authorization", "Bearer $authToken")
                connectTimeout = 10_000
                readTimeout = 10_000
            }
            if (conn.responseCode == 200) {
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                nodeIP = json.optString("nodeIP", "")
            }
            conn.disconnect()
        } catch (_: Exception) {
            // Non-fatal — relay works without a registered node IP
        }
    }

    fun getNodeIP(): String = nodeIP

    fun reset() { nodeIP = "" }
}
