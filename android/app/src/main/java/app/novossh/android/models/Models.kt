package app.novossh.android.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date
import java.util.UUID

enum class AuthMethod { PASSWORD, KEY, AGENT, CERT }
enum class ProxyType { NONE, SOCKS5, HTTP }
enum class ConnectionMode { DIRECT, TAILSCALE }

@Entity(tableName = "hosts")
data class Host(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val label: String,
    val address: String,
    val port: Int = 22,
    val username: String,
    val authMethod: AuthMethod = AuthMethod.PASSWORD,
    val passwordRef: String? = null,   // key into SecureStorage, not plain text
    val keyId: String? = null,
    val certificate: String? = null,   // OpenSSH cert blob for CERT auth
    val passphrase: String? = null,
    val tags: String = "",             // comma-separated
    val group: String = "",            // host group name
    val colorHex: String? = null,
    val notes: String? = null,
    val identityId: String? = null,
    val jumpHostIds: String = "",      // comma-separated host IDs for chaining
    val proxyType: ProxyType = ProxyType.NONE,
    val proxyHost: String? = null,
    val proxyPort: Int? = null,
    val proxyUsername: String? = null,
    val proxyPasswordRef: String? = null,
    val connectionMode: ConnectionMode = ConnectionMode.DIRECT,
    val startupSnippetId: String? = null,
    val tmuxAutoAttach: Boolean = false,
    val lastConnectedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "identity_keys")
data class IdentityKey(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val label: String,
    val privateKeyRef: String,         // key into SecureStorage
    val publicKey: String? = null,
    val hasPassphrase: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "snippets")
data class Snippet(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val label: String,
    val command: String,
    val description: String? = null,
    val tags: String = "",
    val packageId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "snippet_packages")
data class SnippetPackage(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val label: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "session_logs")
data class SessionLog(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val hostId: String,
    val hostLabel: String,
    val startedAt: Long = System.currentTimeMillis(),
    val endedAt: Long? = null,
    val commandCount: Int = 0,
    val bookmarked: Boolean = false,
    val bookmarkComment: String? = null,
)

@Entity(tableName = "port_forwards")
data class PortForwarding(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val hostId: String,
    val label: String,
    val type: String,  // "LOCAL" or "REMOTE"
    val localPort: Int,
    val remoteHost: String,
    val remotePort: Int,
    val status: String = "INACTIVE",  // INACTIVE, CONNECTING, ACTIVE, FAILED
    val createdAt: Long = System.currentTimeMillis(),
)

data class SFTPFile(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val size: Long = 0,
    val modified: Long = System.currentTimeMillis(),
    val permissions: String? = null,
    val owner: String? = null,
    val group: String? = null,
) {
    val icon: String
        get() = when {
            isDirectory -> "folder"
            else -> when (name.substringAfterLast('.', "").lowercase()) {
                "pdf" -> "description"
                "txt", "md", "log" -> "description"
                "zip", "tar", "gz" -> "folder_zip"
                "jpg", "jpeg", "png", "gif" -> "image"
                "mp3", "wav", "m4a" -> "audio_file"
                "mp4", "mov" -> "video_file"
                else -> "insert_drive_file"
            }
        }

    val sizeFormatted: String
        get() {
            return when {
                size < 1024 -> "$size B"
                size < 1024 * 1024 -> "${size / 1024} KB"
                size < 1024 * 1024 * 1024 -> "${size / (1024 * 1024)} MB"
                else -> "${size / (1024 * 1024 * 1024)} GB"
            }
        }
}

data class UserSettings(
    val themeId: String = "novo-dark",
    val terminalScheme: String = "novo-dark",
    val fontSize: Int = 14,
    val fontFamily: String = "Monospace",
    val cursorBlink: Boolean = true,
    val copyOnSelect: Boolean = false,
    val scrollback: Int = 5000,
    val keepAliveSeconds: Int = 30,
    val bellSound: Boolean = false,
    val biometricLock: Boolean = false,
    val hasSeenOnboarding: Boolean = false,
    val keyboardButtons: String = "Tab,Esc,^C,^D,^Z,↑,↓,←,→,Home,End,PgUp,PgDn,|,/,~,-",
    val sendOnEnter: Boolean = true,
)

@Entity(tableName = "vaults")
data class Vault(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val description: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "vault_entries",
    foreignKeys = [androidx.room.ForeignKey(
        entity = Vault::class,
        parentColumns = ["id"],
        childColumns = ["vaultId"],
        onDelete = androidx.room.ForeignKey.CASCADE,
    )],
)
data class VaultEntry(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val vaultId: String,
    val type: String,         // HOST, CREDENTIAL, KEY, NOTE
    val name: String,
    val encryptedData: String, // JSON blob: {host, port, username, password, key, notes, ...}
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
