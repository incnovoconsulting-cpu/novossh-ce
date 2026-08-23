package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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

data class SessionSummary(
    val id: String,
    val name: String?,
    val isActive: Boolean,
    val createdAt: String,
    val commandCount: Int?,
)

data class PlaybackFrame(
    val type: String,       // "command" | "output" | "sync"
    val timestamp: Double,  // ms since session start
    val command: String?,
    val output: String?,
)

data class PlaybackData(
    val sessionId: String,
    val totalDuration: Double,
    val commandCount: Int,
    val frames: List<PlaybackFrame>,
)

class SessionPlaybackViewModel(application: Application) : AndroidViewModel(application) {
    private val secure = SecureStorage(application)

    private val _sessions = MutableStateFlow<List<SessionSummary>>(emptyList())
    val sessions: StateFlow<List<SessionSummary>> = _sessions.asStateFlow()

    private val _playbackData = MutableStateFlow<PlaybackData?>(null)
    val playbackData: StateFlow<PlaybackData?> = _playbackData.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _currentFrame = MutableStateFlow(0)
    val currentFrame: StateFlow<Int> = _currentFrame.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _speed = MutableStateFlow(1.0f)
    val speed: StateFlow<Float> = _speed.asStateFlow()

    private val _displayText = MutableStateFlow("")
    val displayText: StateFlow<String> = _displayText.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var playJob: Job? = null

    private fun token() = secure.get("auth_token")
    private fun base() = (secure.get("api_base_url") ?: "").trimEnd('/')

    fun fetchSessions() {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val raw = withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/sessions").openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 15000; readTimeout = 15000
                    }
                    if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
                } ?: return@launch
                val arr = JSONArray(raw)
                _sessions.value = (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    SessionSummary(
                        id = o.getString("id"),
                        name = o.optString("name").takeIf { it.isNotEmpty() },
                        isActive = o.optBoolean("is_active", false),
                        createdAt = o.optString("created_at", ""),
                        commandCount = if (o.has("commandCount")) o.getInt("commandCount") else null,
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun fetchPlayback(sessionId: String) {
        val token = token() ?: return
        val base = base().ifEmpty { return }
        viewModelScope.launch {
            _isLoading.value = true
            _playbackData.value = null
            _displayText.value = ""
            _currentFrame.value = 0
            _isPlaying.value = false
            try {
                val raw = withContext(Dispatchers.IO) {
                    val conn = (URL("$base/api/sessions/$sessionId/playback").openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 15000; readTimeout = 15000
                    }
                    if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
                } ?: return@launch
                val o = JSONObject(raw)
                val framesArr = o.optJSONArray("frames") ?: JSONArray()
                val frames = (0 until framesArr.length()).map { i ->
                    val f = framesArr.getJSONObject(i)
                    PlaybackFrame(
                        type = f.optString("type", "output"),
                        timestamp = f.optDouble("timestamp", 0.0),
                        command = f.optString("command").takeIf { it.isNotEmpty() },
                        output = f.optString("output").takeIf { it.isNotEmpty() },
                    )
                }
                _playbackData.value = PlaybackData(
                    sessionId = o.getString("sessionId"),
                    totalDuration = o.optDouble("totalDuration", 0.0),
                    commandCount = o.optInt("commandCount", 0),
                    frames = frames,
                )
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun play() {
        val data = _playbackData.value ?: return
        if (_currentFrame.value >= data.frames.size) { seek(0) }
        _isPlaying.value = true
        playJob = viewModelScope.launch {
            val frames = data.frames
            while (_currentFrame.value < frames.size && _isPlaying.value) {
                val idx = _currentFrame.value
                appendFrame(frames[idx])
                _currentFrame.value = idx + 1
                if (idx + 1 < frames.size) {
                    val deltaMs = frames[idx + 1].timestamp - frames[idx].timestamp
                    val clampedMs = minOf(maxOf(deltaMs / _speed.value, 10.0), 2000.0)
                    delay(clampedMs.toLong())
                }
            }
            _isPlaying.value = false
        }
    }

    fun pause() {
        playJob?.cancel()
        _isPlaying.value = false
    }

    fun seek(frameIndex: Int) {
        pause()
        val frames = _playbackData.value?.frames ?: return
        val target = frameIndex.coerceIn(0, frames.size)
        _currentFrame.value = target
        _displayText.value = frames.subList(0, target).joinToString("") { frame ->
            when (frame.type) {
                "command" -> frame.command?.let { "$ $it\n" } ?: ""
                "output" -> frame.output ?: ""
                else -> ""
            }
        }
    }

    fun setSpeed(s: Float) { _speed.value = s }

    private fun appendFrame(frame: PlaybackFrame) {
        val text = when (frame.type) {
            "command" -> frame.command?.let { "$ $it\n" } ?: ""
            "output" -> frame.output ?: ""
            else -> ""
        }
        if (text.isNotEmpty()) _displayText.value += text
    }

    override fun onCleared() {
        super.onCleared()
        playJob?.cancel()
    }
}
