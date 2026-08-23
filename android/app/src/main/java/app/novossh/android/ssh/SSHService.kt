package app.novossh.android.ssh

import app.novossh.android.data.SecureStorage
import app.novossh.android.debug.DebugLog
import app.novossh.android.models.Host
import kotlinx.coroutines.*
import kotlinx.coroutines.CompletableDeferred
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

enum class SSHStatus { IDLE, CONNECTING, CONNECTED, DISCONNECTED, FAILED }

class SSHService(private val secureStorage: SecureStorage? = null) {
    private var webSocket: WebSocket? = null
    var onData: ((ByteArray) -> Unit)? = null
    var onStateChange: ((SSHStatus) -> Unit)? = null

    companion object {
        private val sharedClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
            .build()
    }

    suspend fun connect(host: Host, password: String?, privateKeyPem: String? = null, authToken: String? = null, baseUrl: String? = null) {
        onStateChange?.invoke(SSHStatus.CONNECTING)
        DebugLog.i("SSH", "Connecting via WebSocket to ${host.username}@${host.address}:${host.port}")

        withContext(Dispatchers.IO) {
            try {
                val authPayload = JSONObject().apply {
                    put("type", "connect")
                    put("host", host.address)
                    put("port", host.port)
                    put("username", host.username)
                    if (password != null) put("password", password)
                    if (privateKeyPem != null) put("privateKey", privateKeyPem)
                    put("cols", 80)
                    put("rows", 24)
                    put("term", "xterm-256color")
                }

                val token = authToken ?: secureStorage?.get("auth_token")
                val resolvedBase = (baseUrl ?: secureStorage?.get("api_base_url") ?: "https://ssh.novossh.com:8787")
                    .trimEnd('/')
                    .replace("https://", "wss://")
                    .replace("http://", "ws://")
                val wsUrl = "$resolvedBase/ws/ssh?token=${token ?: ""}"
                val requestBuilder = Request.Builder().url(wsUrl)
                if (token != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                DebugLog.d("SSH", "WebSocket connecting (token=${if (token != null) "present" else "missing"})")
                val request = requestBuilder.build()
                val connected = CompletableDeferred<Boolean>()

                webSocket = sharedClient.newWebSocket(request, object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        DebugLog.i("SSH", "WebSocket connected, sending connect payload")
                        webSocket.send(authPayload.toString())
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        try {
                            val msg = JSONObject(text)
                            when (msg.optString("type")) {
                                "status" -> {
                                    val status = msg.optString("status")
                                    DebugLog.i("SSH", "Status: $status ${msg.optString("message", "")}")
                                    when (status) {
                                        "connected" -> {
                                            onStateChange?.invoke(SSHStatus.CONNECTED)
                                            connected.complete(true)
                                        }
                                        "disconnected" -> {
                                            onStateChange?.invoke(SSHStatus.DISCONNECTED)
                                        }
                                        "connecting" -> {
                                            onStateChange?.invoke(SSHStatus.CONNECTING)
                                        }
                                    }
                                }
                                "data" -> {
                                    val data = msg.optString("data")
                                    onData?.invoke(data.toByteArray(Charsets.UTF_8))
                                }
                                "error" -> {
                                    val errMsg = msg.optString("message")
                                    DebugLog.e("SSH", "Server error: $errMsg")
                                    onStateChange?.invoke(SSHStatus.FAILED)
                                    connected.complete(false)
                                }
                            }
                        } catch (e: Exception) {
                            DebugLog.e("SSH", "Parse error: ${e.message}")
                        }
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        DebugLog.d("SSH", "WebSocket closing: $code $reason")
                        webSocket.close(1000, null)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        DebugLog.i("SSH", "WebSocket closed: $code $reason")
                        onStateChange?.invoke(SSHStatus.DISCONNECTED)
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        DebugLog.e("SSH", "WebSocket failure: ${t.message}")
                        onStateChange?.invoke(SSHStatus.FAILED)
                        connected.complete(false)
                    }
                })

                withTimeout(30_000) {
                    val success = connected.await()
                    if (!success) {
                        disconnect()
                        throw Exception("Connection failed")
                    }
                }
            } catch (e: TimeoutCancellationException) {
                DebugLog.e("SSH", "Connection timeout")
                onStateChange?.invoke(SSHStatus.FAILED)
                disconnect()
            } catch (e: kotlinx.coroutines.CancellationException) {
                DebugLog.d("SSH", "Connection cancelled")
                throw e
            } catch (e: Exception) {
                DebugLog.e("SSH", "Connection failed: ${e.message}")
                onStateChange?.invoke(SSHStatus.FAILED)
            }
        }
    }

    fun sendInput(data: String) {
        val msg = JSONObject().apply {
            put("type", "data")
            put("data", data)
        }
        webSocket?.send(msg.toString())
    }

    fun sendInputBytes(bytes: ByteArray) {
        val msg = JSONObject().apply {
            put("type", "data")
            put("data", bytes.toString(Charsets.UTF_8))
        }
        webSocket?.send(msg.toString())
    }

    fun resize(cols: Int, rows: Int) {
        val msg = JSONObject().apply {
            put("type", "resize")
            put("cols", cols)
            put("rows", rows)
        }
        webSocket?.send(msg.toString())
    }

    fun disconnect() {
        DebugLog.i("SSH", "Disconnecting")
        try {
            val msg = JSONObject().apply { put("type", "disconnect") }
            webSocket?.send(msg.toString())
        } catch (e: Exception) {
            DebugLog.e("SSH", "Send disconnect error: ${e.message}")
        }
        webSocket?.close(1000, "client disconnect")
        webSocket = null
        onStateChange?.invoke(SSHStatus.DISCONNECTED)
    }
}
