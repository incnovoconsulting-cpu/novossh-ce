package app.novossh.android.ssh

import app.novossh.android.data.SecureStorage
import app.novossh.android.debug.DebugLog
import app.novossh.android.models.ConnectionMode
import app.novossh.android.models.Host

class SSHConnectionRouter(private val secureStorage: SecureStorage? = null) {
    private val directClient = DirectSSHClient()
    private val relayService = SSHService(secureStorage)
    private var currentConnectionMode: SSHConnectionMode = SSHConnectionMode.RELAY
    private var currentSessionId: String? = null

    var onData: ((ByteArray) -> Unit)? = null
        set(value) {
            field = value
            directClient.onData = value
            relayService.onData = value
        }

    var onStateChange: ((SSHStatus) -> Unit)? = null
        set(value) {
            field = value
            directClient.onStateChange = value
            relayService.onStateChange = value
        }

    suspend fun connect(
        host: Host,
        password: String? = null,
        privateKeyPem: String? = null,
        authToken: String? = null
    ) {
        val mode = DirectSSHConnectionManager.determineConnectionMode(
            host.address,
            when (host.connectionMode) {
                ConnectionMode.DIRECT -> SSHConnectionMode.DIRECT
                ConnectionMode.TAILSCALE -> SSHConnectionMode.TAILSCALE
                else -> SSHConnectionMode.RELAY
            }
        )

        currentConnectionMode = mode
        currentSessionId = "${host.id}-${System.currentTimeMillis()}"

        DebugLog.i("SSHRouter", "Connecting with mode: $mode")

        when (mode) {
            SSHConnectionMode.DIRECT, SSHConnectionMode.TAILSCALE -> {
                try {
                    directClient.connect(
                        currentSessionId!!,
                        host.address,
                        host.port,
                        host.username,
                        password,
                        privateKeyPem,
                        null,
                        null,
                        mode
                    )
                } catch (e: Exception) {
                    DebugLog.e("SSHRouter", "Direct connection failed: ${e.message}, falling back to relay")
                    currentConnectionMode = SSHConnectionMode.RELAY
                    relayService.connect(host, password, privateKeyPem, authToken)
                }
            }

            SSHConnectionMode.RELAY -> {
                relayService.connect(host, password, privateKeyPem, authToken)
            }
        }
    }

    suspend fun sendInput(data: String) {
        when (currentConnectionMode) {
            SSHConnectionMode.DIRECT, SSHConnectionMode.TAILSCALE -> {
                val sessionId = currentSessionId ?: return
                directClient.send(sessionId, data.toByteArray(Charsets.UTF_8))
            }

            SSHConnectionMode.RELAY -> {
                relayService.sendInput(data)
            }
        }
    }

    suspend fun sendInputBytes(bytes: ByteArray) {
        when (currentConnectionMode) {
            SSHConnectionMode.DIRECT, SSHConnectionMode.TAILSCALE -> {
                val sessionId = currentSessionId ?: return
                directClient.send(sessionId, bytes)
            }

            SSHConnectionMode.RELAY -> {
                relayService.sendInput(String(bytes, Charsets.UTF_8))
            }
        }
    }

    suspend fun resize(cols: Int, rows: Int) {
        when (currentConnectionMode) {
            SSHConnectionMode.DIRECT, SSHConnectionMode.TAILSCALE -> {
                val sessionId = currentSessionId ?: return
                directClient.resize(sessionId, cols, rows)
            }

            SSHConnectionMode.RELAY -> {
                relayService.resize(cols, rows)
            }
        }
    }

    suspend fun disconnect() {
        DebugLog.i("SSHRouter", "Disconnecting (mode: $currentConnectionMode)")
        when (currentConnectionMode) {
            SSHConnectionMode.DIRECT, SSHConnectionMode.TAILSCALE -> {
                val sessionId = currentSessionId ?: return
                directClient.disconnect(sessionId)
                currentSessionId = null
            }

            SSHConnectionMode.RELAY -> {
                relayService.disconnect()
            }
        }
        currentConnectionMode = SSHConnectionMode.RELAY
    }
}
