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
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class P2PMessage(
    val id: String,
    val from: String,
    val type: String,
    val sdp: String?,
    val candidate: String?,
    val sdpMid: String?,
    val sdpMLineIndex: Int?,
    val sessionName: String?,
)

data class P2PChatMessage(val fromSelf: Boolean, val text: String)

enum class P2PState { IDLE, OFFERING, WAITING, CONNECTED, FAILED }

class P2PViewModel(app: Application) : AndroidViewModel(app) {
    private val secure = SecureStorage(app)
    private val _state = MutableStateFlow(P2PState.IDLE)
    val state: StateFlow<P2PState> = _state

    private val _messages = MutableStateFlow<List<P2PChatMessage>>(emptyList())
    val messages: StateFlow<List<P2PChatMessage>> = _messages

    private val _peers = MutableStateFlow<List<String>>(emptyList())
    val peers: StateFlow<List<String>> = _peers

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _pendingMessages = MutableStateFlow<List<P2PMessage>>(emptyList())
    val pendingMessages: StateFlow<List<P2PMessage>> = _pendingMessages

    private val _connectionState = MutableStateFlow(P2PState.IDLE)
    val connectionState: StateFlow<P2PState> = _connectionState

    private val _connectedPeer = MutableStateFlow<String?>(null)
    val connectedPeer: StateFlow<String?> = _connectedPeer

    private val _isPolling = MutableStateFlow(false)
    val isPolling: StateFlow<Boolean> = _isPolling

    private val _chatMessages = MutableStateFlow<List<P2PChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<P2PChatMessage>> = _chatMessages

    fun startSession(sessionName: String) {
        viewModelScope.launch {
            _state.value = P2PState.FAILED
            _error.value = "P2P not available in this build"
        }
    }

    fun joinSession(sessionName: String) {
        viewModelScope.launch {
            _state.value = P2PState.FAILED
            _error.value = "P2P not available in this build"
        }
    }

    fun sendMessage(text: String) {
        _error.value = "P2P not available in this build"
    }

    fun sendChatMessage(text: String) {
        _error.value = "P2P not available in this build"
    }

    fun sendOffer(peerId: String, sessionName: String) {
        _error.value = "P2P not available in this build"
    }

    fun acceptOffer(msg: P2PMessage) {
        _error.value = "P2P not available in this build"
    }

    fun declineOffer(id: String) {
        _error.value = "P2P not available in this build"
    }

    fun clearError() {
        _error.value = null
    }

    fun startPolling() {
        _isPolling.value = true
    }

    fun stopPolling() {
        _isPolling.value = false
    }

    fun disconnect() {
        _state.value = P2PState.IDLE
        _messages.value = emptyList()
        _peers.value = emptyList()
        _connectedPeer.value = null
        _isPolling.value = false
        _chatMessages.value = emptyList()
    }

    fun refreshPeers() {
        _peers.value = emptyList()
    }
}
