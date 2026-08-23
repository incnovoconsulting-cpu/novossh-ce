package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class AuditEvent(
    val id: String,
    val action: String,
    val resourceType: String?,
    val resourceId: String?,
    val details: String?,
    val ipAddress: String?,
    val createdAt: String,
)

class AuditViewModel(application: Application) : AndroidViewModel(application) {
    private val secure = SecureStorage(application)

    private val _events = MutableStateFlow<List<AuditEvent>>(emptyList())
    val events: StateFlow<List<AuditEvent>> = _events.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var offset = 0
    private val limit = 50

    private fun token() = secure.get("auth_token")
    private fun base() = (secure.get("api_base_url") ?: "").trimEnd('/')

    fun fetchFirst(teamId: String? = null) {
        offset = 0
        _events.value = emptyList()
        _hasMore.value = true
        fetch(teamId)
    }

    fun fetchMore(teamId: String? = null) {
        if (!_hasMore.value || _isLoading.value) return
        fetch(teamId)
    }

    private fun fetch(teamId: String?) {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                var url = "$base/api/audit-logs/logs?limit=$limit&offset=$offset"
                if (teamId != null) url += "&teamId=$teamId"
                val raw = withContext(Dispatchers.IO) {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 15000; readTimeout = 15000
                    }
                    if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
                } ?: return@launch
                val obj = JSONObject(raw)
                val arr = obj.optJSONArray("data") ?: return@launch
                val newEvents = (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    AuditEvent(
                        id = o.optString("id", i.toString()),
                        action = o.optString("action", ""),
                        resourceType = o.optString("resource_type").takeIf { it.isNotEmpty() },
                        resourceId = o.optString("resource_id").takeIf { it.isNotEmpty() },
                        details = o.optString("details").takeIf { it.isNotEmpty() },
                        ipAddress = o.optString("ip_address").takeIf { it.isNotEmpty() },
                        createdAt = o.optString("created_at", ""),
                    )
                }
                _events.value = _events.value + newEvents
                offset += newEvents.size
                _hasMore.value = newEvents.size == limit
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }
}
