package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val isRead: Boolean,
    val createdAt: String,
)

class NotificationViewModel(application: Application) : AndroidViewModel(application) {
    private val secure = SecureStorage(application)

    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private fun token() = secure.get("auth_token")
    private fun base() = (secure.get("api_base_url") ?: "").trimEnd('/')

    init {
        fetch()
        startPolling()
    }

    fun fetch() {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val raw = withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/notifications?limit=50").openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 10000; readTimeout = 10000
                    }
                    if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText()
                    else null
                } ?: return@launch
                val arr = JSONObject(raw).optJSONArray("notifications") ?: JSONArray()
                _notifications.value = (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    AppNotification(
                        id = o.getString("id"),
                        type = o.optString("type", "info"),
                        title = o.optString("title", ""),
                        message = o.optString("message", ""),
                        isRead = o.optBoolean("isRead", false),
                        createdAt = o.optString("createdAt", ""),
                    )
                }
                _unreadCount.value = _notifications.value.count { !it.isRead }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun markRead(id: String) {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/notifications/$id/read").openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 10000; readTimeout = 10000
                    }
                    conn.responseCode
                    conn.disconnect()
                }
                _notifications.value = _notifications.value.map {
                    if (it.id == id) it.copy(isRead = true) else it
                }
                _unreadCount.value = _notifications.value.count { !it.isRead }
            } catch (_: Exception) {}
        }
    }

    fun delete(id: String) {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/notifications/$id").openConnection() as HttpURLConnection).apply {
                        requestMethod = "DELETE"
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 10000; readTimeout = 10000
                    }
                    conn.responseCode
                    conn.disconnect()
                }
                _notifications.value = _notifications.value.filter { it.id != id }
                _unreadCount.value = _notifications.value.count { !it.isRead }
            } catch (_: Exception) {}
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(60_000)
                fetchUnreadCount()
            }
        }
    }

    private suspend fun fetchUnreadCount() {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        try {
            val raw = withContext(Dispatchers.IO) {
                val conn = (URL("$base/api/notifications/unread-count").openConnection() as HttpURLConnection).apply {
                    setRequestProperty("Authorization", "Bearer $token")
                    connectTimeout = 10000; readTimeout = 10000
                }
                if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
            } ?: return
            _unreadCount.value = JSONObject(raw).optInt("count", 0)
        } catch (_: Exception) {}
    }
}
