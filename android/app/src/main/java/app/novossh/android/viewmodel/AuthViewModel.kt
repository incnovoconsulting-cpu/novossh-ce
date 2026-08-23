package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import app.novossh.android.debug.DebugLog
import app.novossh.android.tailscale.TailscaleManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class AuthState(
    val isLoading: Boolean = true,
    val isAuthenticated: Boolean = false,
    val email: String? = null,
    val emailVerified: Boolean = true,
    val error: String? = null,
)

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val secure = SecureStorage(application)
    private val tailscale = TailscaleManager(application, secure)
    private val _authState = MutableStateFlow(AuthState())
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    companion object {
        private const val TAG = "AuthViewModel"
        private const val API_BASE = "https://ssh.novossh.com:8787"
        private const val TOKEN_KEY = "auth_token"
        private const val EMAIL_KEY = "auth_email"
        private const val REFRESH_TOKEN_KEY = "auth_refresh_token"
    }

    init {
        DebugLog.enabled = true
        DebugLog.i(TAG, "AuthViewModel initialized, API=$API_BASE")
        checkAuth()
    }

    private fun checkAuth() {
        val token = secure.get(TOKEN_KEY)
        val email = secure.get(EMAIL_KEY)
        if (token != null && email != null) {
            _authState.value = AuthState(isLoading = false, isAuthenticated = true, email = email)
            checkEmailVerification()
        } else {
            _authState.value = AuthState(isLoading = false, isAuthenticated = false)
        }
    }

    fun login(email: String, password: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(isLoading = true, error = null)
            DebugLog.i(TAG, "Login attempt")
            var conn: HttpURLConnection? = null
            try {
                withContext(Dispatchers.IO) {
                    val url = URL("$API_BASE/api/auth/login")
                    conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json")
                        doOutput = true
                        connectTimeout = 15000
                        readTimeout = 15000
                    }

                    val body = JSONObject().apply {
                        put("email", email)
                        put("password", password)
                    }.toString()

                    conn!!.outputStream.buffered().use { it.write(body.toByteArray()) }

                    DebugLog.http(TAG, "POST", url.toExternalForm(), conn!!.responseCode)

                    if (conn!!.responseCode == 200) {
                        val raw = conn!!.inputStream.bufferedReader().readText()
                        val response = JSONObject(raw)
                        val accessToken = response.getString("accessToken")
                        val userEmail = response.optJSONObject("user")?.optString("email") ?: email
                        DebugLog.i(TAG, "Login success: $userEmail")

                        secure.put(TOKEN_KEY, accessToken)
                        secure.put(EMAIL_KEY, userEmail)
                        response.optString("refreshToken").takeIf { it.isNotEmpty() }
                            ?.let { secure.put(REFRESH_TOKEN_KEY, it) }
                        tailscale.prepare(accessToken)

                        _authState.value = AuthState(isLoading = false, isAuthenticated = true, email = userEmail)
                        withContext(Dispatchers.Main) { onResult(true, null) }
                    } else {
                        val errorBody = conn!!.errorStream?.bufferedReader()?.readText() ?: ""
                        DebugLog.e(TAG, "HTTP ${conn!!.responseCode}")
                        val errorMsg = try { JSONObject(errorBody).optString("error") ?: "Login failed" } catch (_: Exception) { "Login failed" }
                        val fullMsg = "HTTP ${conn!!.responseCode}: $errorMsg"
                        _authState.value = AuthState(isLoading = false, error = fullMsg)
                        withContext(Dispatchers.Main) { onResult(false, fullMsg) }
                    }
                }
            } catch (e: Exception) {
                val detail = e.message ?: e.javaClass.simpleName
                DebugLog.e(TAG, "Login failed: $detail")
                val msg = when {
                    detail.contains("timeout", true) -> "Connection timeout"
                    detail.contains("connect", true) -> "Cannot reach server"
                    detail.contains("ssl", true) || detail.contains("certificate", true) -> "SSL error: $detail"
                    detail.contains("cleartext", true) -> "HTTP not allowed"
                    else -> "Network error: $detail"
                }
                _authState.value = AuthState(isLoading = false, error = msg)
                withContext(Dispatchers.Main) { onResult(false, msg) }
            } finally {
                conn?.disconnect()
            }
        }
    }

    fun signup(email: String, password: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            _authState.value = _authState.value.copy(isLoading = true, error = null)
            DebugLog.i(TAG, "Signup attempt")
            var conn: HttpURLConnection? = null
            try {
                withContext(Dispatchers.IO) {
                    val url = URL("$API_BASE/api/auth/signup")
                    conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json")
                        doOutput = true
                        connectTimeout = 15000
                        readTimeout = 15000
                    }

                    val body = JSONObject().apply {
                        put("email", email)
                        put("password", password)
                    }.toString()

                    conn!!.outputStream.buffered().use { it.write(body.toByteArray()) }

                    DebugLog.http(TAG, "POST", url.toExternalForm(), conn!!.responseCode)

                    if (conn!!.responseCode == 200) {
                        val raw = conn!!.inputStream.bufferedReader().readText()
                        val response = JSONObject(raw)
                        val accessToken = response.getString("accessToken")
                        val userEmail = response.optJSONObject("user")?.optString("email") ?: email
                        DebugLog.i(TAG, "Signup success: $userEmail")

                        secure.put(TOKEN_KEY, accessToken)
                        secure.put(EMAIL_KEY, userEmail)
                        response.optString("refreshToken").takeIf { it.isNotEmpty() }
                            ?.let { secure.put(REFRESH_TOKEN_KEY, it) }
                        tailscale.prepare(accessToken)

                        _authState.value = AuthState(isLoading = false, isAuthenticated = true, email = userEmail)
                        withContext(Dispatchers.Main) { onResult(true, null) }
                    } else {
                        val errorBody = conn!!.errorStream?.bufferedReader()?.readText() ?: ""
                        DebugLog.e(TAG, "HTTP ${conn!!.responseCode}")
                        val errorMsg = try { JSONObject(errorBody).optString("error") ?: "Signup failed" } catch (_: Exception) { "Signup failed" }
                        val fullMsg = "HTTP ${conn!!.responseCode}: $errorMsg"
                        _authState.value = AuthState(isLoading = false, error = fullMsg)
                        withContext(Dispatchers.Main) { onResult(false, fullMsg) }
                    }
                }
            } catch (e: Exception) {
                val detail = e.message ?: e.javaClass.simpleName
                DebugLog.e(TAG, "Signup failed: $detail")
                val msg = when {
                    detail.contains("timeout", true) -> "Connection timeout"
                    detail.contains("connect", true) -> "Cannot reach server"
                    detail.contains("ssl", true) || detail.contains("certificate", true) -> "SSL error: $detail"
                    detail.contains("cleartext", true) -> "HTTP not allowed"
                    else -> "Network error: $detail"
                }
                _authState.value = AuthState(isLoading = false, error = msg)
                withContext(Dispatchers.Main) { onResult(false, msg) }
            } finally {
                conn?.disconnect()
            }
        }
    }

    fun loginWithToken(token: String, expiresIn: Long, onResult: (Boolean, String?) -> Unit) {
        val expiresAt = System.currentTimeMillis() + expiresIn * 1000
        secure.put(TOKEN_KEY, token)
        secure.put(EMAIL_KEY, "oauth")
        secure.put("auth_expires", expiresAt.toString())
        _authState.value = AuthState(isLoading = false, isAuthenticated = true, email = "oauth")
        viewModelScope.launch { tailscale.prepare(token) }
        onResult(true, null)
    }

    fun logout() {
        secure.delete(TOKEN_KEY)
        secure.delete(EMAIL_KEY)
        secure.delete(REFRESH_TOKEN_KEY)
        tailscale.reset()
        _authState.value = AuthState(isLoading = false, isAuthenticated = false)
    }

    fun getToken(): String? = secure.get(TOKEN_KEY)

    fun checkEmailVerification() {
        val token = secure.get(TOKEN_KEY) ?: return
        val base = secure.get("api_base_url")?.trimEnd('/') ?: API_BASE
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/auth/me").openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 15000; readTimeout = 15000
                    }
                    if (conn.responseCode == 200) {
                        val json = JSONObject(conn.inputStream.bufferedReader().readText())
                        val verified = json.optBoolean("emailVerified", true)
                        _authState.value = _authState.value.copy(emailVerified = verified)
                    }
                    conn.disconnect()
                }
            } catch (_: Exception) { }
        }
    }

    fun resendVerificationEmail(onResult: (Boolean, String?) -> Unit) {
        val token = secure.get(TOKEN_KEY) ?: return
        val base = secure.get("api_base_url")?.trimEnd('/') ?: API_BASE
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/auth/resend-verification").openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Authorization", "Bearer $token")
                        setRequestProperty("Content-Type", "application/json")
                        connectTimeout = 15000; readTimeout = 15000
                    }
                    val success = conn.responseCode == 200
                    conn.disconnect()
                    withContext(Dispatchers.Main) {
                        onResult(success, if (success) null else "Failed to resend verification email")
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onResult(false, e.message) }
            }
        }
    }

    /** Attempts a silent refresh. Returns the new access token or null on failure (triggers logout). */
    suspend fun refreshAccessToken(): String? = withContext(Dispatchers.IO) {
        val refreshToken = secure.get(REFRESH_TOKEN_KEY) ?: return@withContext null
        val base = secure.get("api_base_url")?.trimEnd('/') ?: API_BASE
        try {
            val conn = (URL("$base/api/auth/refresh").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true; connectTimeout = 15000; readTimeout = 15000
            }
            conn.outputStream.buffered().use {
                it.write(JSONObject().apply { put("refreshToken", refreshToken) }.toString().toByteArray())
            }
            if (conn.responseCode == 200) {
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                val newToken = json.getString("accessToken")
                secure.put(TOKEN_KEY, newToken)
                json.optString("refreshToken").takeIf { it.isNotEmpty() }
                    ?.let { secure.put(REFRESH_TOKEN_KEY, it) }
                conn.disconnect()
                newToken
            } else {
                conn.disconnect()
                // Refresh token expired — force logout on main thread
                withContext(Dispatchers.Main) { logout() }
                null
            }
        } catch (_: Exception) { null }
    }
}
