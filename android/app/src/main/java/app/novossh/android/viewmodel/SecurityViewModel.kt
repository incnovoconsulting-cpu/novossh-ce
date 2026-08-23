package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class PasskeyCredential(
    val id: String,
    val name: String?,
    val created_at: String,
    val last_used_at: String?,
    val transports: List<String>,
)

class SecurityViewModel(app: Application) : AndroidViewModel(app) {
    private val secure = SecureStorage(app)

    private val _credentials = MutableStateFlow<List<PasskeyCredential>>(emptyList())
    val credentials: StateFlow<List<PasskeyCredential>> = _credentials

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun clearError() { _error.value = null }

    // MARK: - Credential management

    fun fetchCredentials() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val data = get("/api/webauthn/credentials")
                val obj = JSONObject(data)
                val arr = obj.getJSONArray("credentials")
                _credentials.value = (0 until arr.length()).map { i ->
                    val c = arr.getJSONObject(i)
                    val transportsArr = c.optJSONArray("transports")
                    val transports = if (transportsArr != null) {
                        (0 until transportsArr.length()).map { transportsArr.getString(it) }
                    } else emptyList()
                    PasskeyCredential(
                        id = c.getString("id"),
                        name = c.optString("name").ifEmpty { null },
                        created_at = c.optString("created_at"),
                        last_used_at = c.optString("last_used_at").ifEmpty { null },
                        transports = transports,
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun deleteCredential(id: String) {
        viewModelScope.launch {
            try {
                delete("/api/webauthn/credentials/$id")
                _credentials.value = _credentials.value.filter { it.id != id }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun renameCredential(id: String, name: String) {
        viewModelScope.launch {
            try {
                val body = JSONObject().apply { put("name", name) }
                put("/api/webauthn/credentials/$id", body)
                _credentials.value = _credentials.value.map {
                    if (it.id == id) it.copy(name = name) else it
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    // MARK: - SAML

    /** Returns the IdP redirect URL for a SAML SSO login, or null on failure. */
    suspend fun getSamlLoginUrl(organizationId: String): String? = withContext(Dispatchers.IO) {
        try {
            val data = get("/api/saml/login?organizationId=$organizationId")
            val obj = JSONObject(data)
            obj.optString("redirectUrl").ifEmpty { null }
        } catch (e: Exception) {
            _error.value = e.message
            null
        }
    }

    // MARK: - HTTP helpers

    private fun baseUrl() = secure.get("api_base_url") ?: "https://ssh.novossh.com:8787"
    private fun token() = secure.get("auth_token") ?: ""

    private suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun put(path: String, body: JSONObject): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "PUT"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun delete(path: String): Unit = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "DELETE"
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.responseCode
    }
}
