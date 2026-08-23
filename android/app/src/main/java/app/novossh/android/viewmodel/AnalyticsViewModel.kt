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

data class SessionMetrics(
    val totalSessions: Int,
    val avgDuration: Double,
    val totalCommands: Int,
    val trendSessions: Int?,
    val trendCommands: Int?,
)

data class TopCommand(val command: String, val count: Int, val successRate: Double?)

data class HeatmapCell(val hour: Int, val day: Int, val value: Int)

class AnalyticsViewModel(application: Application) : AndroidViewModel(application) {
    private val secure = SecureStorage(application)

    private val _sessionMetrics = MutableStateFlow<SessionMetrics?>(null)
    val sessionMetrics: StateFlow<SessionMetrics?> = _sessionMetrics.asStateFlow()

    private val _topCommands = MutableStateFlow<List<TopCommand>>(emptyList())
    val topCommands: StateFlow<List<TopCommand>> = _topCommands.asStateFlow()

    private val _heatmap = MutableStateFlow<List<HeatmapCell>>(emptyList())
    val heatmap: StateFlow<List<HeatmapCell>> = _heatmap.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private fun token() = secure.get("auth_token")
    private fun base() = (secure.get("api_base_url") ?: "").trimEnd('/')

    fun fetchAll(days: Int = 30) {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        _isLoading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    // Session metrics
                    val smRaw = get("$base/api/analytics/sessions?days=$days", token)
                    if (smRaw != null) {
                        val d = JSONObject(smRaw).optJSONObject("data")
                        if (d != null) {
                            val trend = d.optJSONObject("trend")
                            _sessionMetrics.value = SessionMetrics(
                                totalSessions = d.optInt("totalSessions", 0),
                                avgDuration = d.optDouble("avgDuration", 0.0),
                                totalCommands = d.optInt("totalCommands", 0),
                                trendSessions = trend?.optInt("totalSessions"),
                                trendCommands = trend?.optInt("totalCommands"),
                            )
                        }
                    }

                    // Top commands
                    val cmdRaw = get("$base/api/analytics/commands?days=$days", token)
                    if (cmdRaw != null) {
                        val arr = JSONObject(cmdRaw).optJSONObject("data")?.optJSONArray("topCommands")
                        if (arr != null) {
                            _topCommands.value = (0 until arr.length()).map { i ->
                                val o = arr.getJSONObject(i)
                                TopCommand(
                                    command = o.optString("command", ""),
                                    count = o.optInt("count", 0),
                                    successRate = if (o.has("successRate")) o.getDouble("successRate") else null,
                                )
                            }
                        }
                    }

                    // Heatmap
                    val hmRaw = get("$base/api/analytics/heatmap", token)
                    if (hmRaw != null) {
                        val arr = JSONObject(hmRaw).optJSONObject("data")?.optJSONArray("heatmap")
                        if (arr != null) {
                            _heatmap.value = (0 until arr.length()).map { i ->
                                val o = arr.getJSONObject(i)
                                HeatmapCell(
                                    hour = o.optInt("hour", 0),
                                    day = o.optInt("day", 0),
                                    value = o.optInt("value", 0),
                                )
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun get(urlStr: String, token: String): String? {
        return try {
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                setRequestProperty("Authorization", "Bearer $token")
                connectTimeout = 15000; readTimeout = 15000
            }
            if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
        } catch (_: Exception) { null }
    }
}
