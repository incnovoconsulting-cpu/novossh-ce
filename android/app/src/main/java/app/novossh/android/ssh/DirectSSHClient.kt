package app.novossh.android.ssh

import app.novossh.android.debug.DebugLog
import com.jcraft.jsch.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap

enum class SSHConnectionMode {
    DIRECT,
    TAILSCALE,
    RELAY
}

object NetworkClassifier {
    fun isPrivateIPRange(address: String): Boolean {
        val ipv4Pattern = """^(\d+)\.(\d+)\.(\d+)\.(\d+)$""".toRegex()
        val match = ipv4Pattern.find(address) ?: return isPrivateIPv6(address)

        val (a, b, c, d) = match.destructured
        val aInt = a.toIntOrNull() ?: return false
        val bInt = b.toIntOrNull() ?: return false
        val cInt = c.toIntOrNull() ?: return false
        val dInt = d.toIntOrNull() ?: return false

        if (aInt !in 0..255 || bInt !in 0..255 || cInt !in 0..255 || dInt !in 0..255) return false
        if (aInt == 0) return true
        if (aInt == 10) return true
        if (aInt == 172 && bInt in 16..31) return true
        if (aInt == 192 && bInt == 168) return true
        if (aInt == 127) return true
        if (aInt == 169 && bInt == 254) return true

        return false
    }

    private fun isPrivateIPv6(address: String): Boolean {
        return address == "::1" || address == "::" ||
            address.startsWith("fc00:") || address.startsWith("fd") ||
            address.startsWith("fe80:")
    }

    fun isTailscaleIP(address: String): Boolean {
        if (address.startsWith("100.")) {
            val ipv4Pattern = """^100\.\d+\.\d+\.\d+$""".toRegex()
            return ipv4Pattern.matches(address)
        }
        if (address.endsWith(".ts.net")) return true
        if (address.startsWith("fd7a:115c:")) return true
        return false
    }
}

object DirectSSHConnectionManager {
    fun determineConnectionMode(
        hostAddress: String,
        requestedMode: SSHConnectionMode?
    ): SSHConnectionMode {
        return when (requestedMode) {
            SSHConnectionMode.DIRECT -> SSHConnectionMode.DIRECT
            SSHConnectionMode.TAILSCALE -> {
                if (NetworkClassifier.isTailscaleIP(hostAddress)) SSHConnectionMode.TAILSCALE else SSHConnectionMode.DIRECT
            }
            SSHConnectionMode.RELAY, null -> {
                // Auto-upgrade: private/local IPs never need the relay
                if (NetworkClassifier.isPrivateIPRange(hostAddress) || NetworkClassifier.isTailscaleIP(hostAddress)) {
                    SSHConnectionMode.DIRECT
                } else {
                    SSHConnectionMode.RELAY
                }
            }
        }
    }

    fun resolveTarget(
        hostAddress: String,
        hostPort: Int,
        connectionMode: SSHConnectionMode,
        tailscalePort: Int = 2222,
        tailscaleIP: String? = null,
    ): Pair<String, Int> {
        return when (connectionMode) {
            SSHConnectionMode.TAILSCALE -> {
                // Connect directly via Tailscale IP (P2P, no relay)
                if (!tailscaleIP.isNullOrEmpty()) {
                    Pair(tailscaleIP, hostPort)
                } else {
                    // Fallback: route through local Tailscale reverse tunnel
                    Pair("127.0.0.1", tailscalePort)
                }
            }
            SSHConnectionMode.DIRECT -> Pair(hostAddress, hostPort)
            SSHConnectionMode.RELAY -> Pair(hostAddress, hostPort)
        }
    }
}

data class DirectSSHSession(
    val sessionId: String,
    val connectionMode: SSHConnectionMode,
    val disconnect: suspend () -> Unit
)

class HostKeyVerifier(private val knownHostsFile: File) : HostKeyRepository {
    private val knownHosts = ConcurrentHashMap<String, String>()

    init {
        loadKnownHosts()
    }

    private fun loadKnownHosts() {
        try {
            if (knownHostsFile.exists()) {
                knownHostsFile.readLines().forEach { line ->
                    val trimmed = line.trim()
                    if (trimmed.isEmpty() || trimmed.startsWith("#")) return@forEach
                    val parts = trimmed.split("\\s+".toRegex())
                    if (parts.size >= 2) {
                        val host = parts[0]
                        val fingerprint = parts.last()
                        knownHosts[host] = fingerprint
                    }
                }
            }
        } catch (e: Exception) {
            DebugLog.e("HostKeyVerifier", "Failed to load known_hosts: ${e.message}")
        }
    }

    private fun saveKnownHost(host: String, fingerprint: String) {
        try {
            knownHosts[host] = fingerprint
            knownHostsFile.parentFile?.mkdirs()
            knownHostsFile.writeText(knownHosts.entries.joinToString("\n") { "${it.key} ${it.value}" } + "\n")
        } catch (e: Exception) {
            DebugLog.e("HostKeyVerifier", "Failed to save host key: ${e.message}")
        }
    }

    private fun fingerprint(key: ByteArray): String {
        return key.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    override fun check(host: String, key: ByteArray): Int {
        val fp = fingerprint(key)
        val existing = knownHosts[host]
        return if (existing != null) {
            if (existing == fp) HostKeyRepository.OK else HostKeyRepository.CHANGED
        } else {
            saveKnownHost(host, fp)
            HostKeyRepository.OK
        }
    }

    override fun add(hk: HostKey, ui: UserInfo?) {
        val keyBytes = java.util.Base64.getDecoder().decode(hk.key)
        val fp = fingerprint(keyBytes)
        saveKnownHost(hk.host, fp)
    }

    override fun remove(host: String?, type: String?) {
        if (host != null) {
            val removed = knownHosts.keys.removeAll { it == host || it.startsWith("$host:") }
            if (removed) rewriteFile()
        }
    }

    override fun remove(host: String?, type: String?, key: ByteArray?) {
        if (host != null) {
            val removed = knownHosts.keys.removeAll { it == host || it.startsWith("$host:") }
            if (removed) rewriteFile()
        }
    }

    private fun rewriteFile() {
        try {
            knownHostsFile.writeText(knownHosts.entries.joinToString("\n") { "${it.key} ${it.value}" } + "\n")
        } catch (e: Exception) {
            DebugLog.e("HostKeyVerifier", "Failed to rewrite known_hosts: ${e.message}")
        }
    }

    override fun getHostKey(): Array<HostKey> = emptyArray()

    override fun getHostKey(host: String?, type: String?): Array<HostKey> = emptyArray()

    override fun getKnownHostsRepositoryID(): String = knownHostsFile.absolutePath
}

class DirectSSHClient(private val knownHostsFile: File? = null) {
    private val sessions = ConcurrentHashMap<String, ChannelShell>()
    private val streams = ConcurrentHashMap<String, Pair<InputStream, OutputStream>>()
    private val scopes = ConcurrentHashMap<String, CoroutineScope>()

    var onData: ((ByteArray) -> Unit)? = null
    var onStateChange: ((SSHStatus) -> Unit)? = null

    private fun createJsch(): JSch {
        val jsch = JSch()
        jsch.hostKeyRepository = HostKeyVerifier(
            knownHostsFile ?: File(System.getProperty("user.home"), ".novossh/known_hosts")
        )
        return jsch
    }

    suspend fun connect(
        sessionId: String,
        hostAddress: String,
        hostPort: Int,
        username: String,
        password: String? = null,
        privateKey: String? = null,
        passphrase: String? = null,
        certificate: String? = null,
        connectionMode: SSHConnectionMode
    ) {
        withContext(Dispatchers.IO) {
            val jsch = createJsch()
            var session: Session? = null
            try {
                onStateChange?.invoke(SSHStatus.CONNECTING)

                val mode = DirectSSHConnectionManager.determineConnectionMode(hostAddress, connectionMode)
                val (connectHost, connectPort) = DirectSSHConnectionManager.resolveTarget(hostAddress, hostPort, mode)

                DebugLog.d("SSH", "Connecting to $connectHost:$connectPort (mode: $mode)")

                session = jsch.getSession(username, connectHost, connectPort)

                if (password != null) {
                    session.setPassword(password)
                } else if (privateKey != null) {
                    val passphraseBytes = passphrase?.toByteArray()
                    if (certificate != null) {
                        // Cert auth: concatenate cert + private key
                        val combinedKey = "$certificate\n$privateKey"
                        jsch.addIdentity("cert_${sessionId}", combinedKey.toByteArray(), null, passphraseBytes)
                    } else {
                        jsch.addIdentity("key_${sessionId}", privateKey.toByteArray(), null, passphraseBytes)
                    }
                }

                session.setConfig("StrictHostKeyChecking", "accept-new")
                session.setConfig("PreferredAuthentications", "publickey,password")

                session.connect(15_000)
                DebugLog.i("SSH", "JSch session connected")

                val channel = session.openChannel("shell") as ChannelShell
                channel.setPtyType("xterm-256color", 80, 24, 640, 480)
                channel.setEnv("TERM", "xterm-256color")
                channel.setEnv("LANG", "en_US.UTF-8")
                channel.connect(15_000)
                DebugLog.i("SSH", "Shell channel opened")

                val input = channel.inputStream
                val output = channel.outputStream

                sessions[sessionId] = channel
                streams[sessionId] = Pair(input, output)

                val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
                scopes[sessionId] = scope

                onStateChange?.invoke(SSHStatus.CONNECTED)

                scope.launch {
                    try {
                        val buffer = ByteArray(4096)
                        while (channel.isConnected) {
                            val len = input.read(buffer)
                            if (len > 0) {
                                val data = buffer.copyOf(len)
                                onData?.invoke(data)
                            } else if (len == -1) break
                        }
                        onStateChange?.invoke(SSHStatus.DISCONNECTED)
                    } catch (e: Exception) {
                        DebugLog.e("SSH", "Read error: ${e.message}")
                        onStateChange?.invoke(SSHStatus.FAILED)
                    }
                }
            } catch (e: Exception) {
                DebugLog.e("SSH", "Connection failed: ${e.message}")
                session?.disconnect()
                onStateChange?.invoke(SSHStatus.FAILED)
                throw e
            }
        }
    }

    suspend fun send(sessionId: String, data: ByteArray) {
        withContext(Dispatchers.IO) {
            try {
                val (_, output) = streams[sessionId] ?: return@withContext
                output.write(data)
                output.flush()
            } catch (e: Exception) {
                DebugLog.e("SSH", "Send error: ${e.message}")
            }
        }
    }

    suspend fun resize(sessionId: String, cols: Int, rows: Int) {
        withContext(Dispatchers.IO) {
            try {
                val channel = sessions[sessionId] ?: return@withContext
                channel.setPtySize(cols, rows, 0, 0)
            } catch (e: Exception) {
                DebugLog.e("SSH", "Resize error: ${e.message}")
            }
        }
    }

    suspend fun disconnect(sessionId: String) {
        withContext(Dispatchers.IO) {
            try {
                scopes.remove(sessionId)?.cancel()
                sessions.remove(sessionId)?.disconnect()
                streams.remove(sessionId)
                DebugLog.i("SSH", "Session disconnected")
            } catch (e: Exception) {
                DebugLog.e("SSH", "Disconnect error: ${e.message}")
            }
        }
    }

    fun disconnectAll() {
        scopes.values.forEach { it.cancel() }
        scopes.clear()
        sessions.values.forEach { try { it.disconnect() } catch (_: Exception) {} }
        sessions.clear()
        streams.clear()
    }
}
