package app.novossh.android.ssh

import android.content.Context
import android.os.Environment
import app.novossh.android.debug.DebugLog
import app.novossh.android.models.Host
import app.novossh.android.models.SFTPFile
import com.jcraft.jsch.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.Vector

class SFTPService(private val context: Context) {
    private var session: Session? = null
    private var channelSftp: ChannelSftp? = null

    suspend fun connect(
        host: Host,
        password: String? = null,
        privateKeyPem: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect() // Ensure clean slate
            DebugLog.i("SFTP", "SFTP connecting to ${host.username}@${host.address}:${host.port}")
            val jsch = JSch()
            
            val knownHostsFile = File(context.filesDir, "known_hosts")
            jsch.hostKeyRepository = HostKeyVerifier(knownHostsFile)

            session = jsch.getSession(host.username, host.address, host.port)
            if (password != null) {
                session?.setPassword(password)
            } else if (privateKeyPem != null) {
                jsch.addIdentity("key_${host.id}", privateKeyPem.toByteArray(), null, null)
            }

            session?.setConfig("StrictHostKeyChecking", "accept-new")
            session?.setConfig("PreferredAuthentications", "publickey,password")
            
            session?.connect(15_000)
            DebugLog.i("SFTP", "JSch session connected for SFTP")

            val channel = session?.openChannel("sftp") as ChannelSftp
            channel.connect(15_000)
            channelSftp = channel
            DebugLog.i("SFTP", "SFTP channel opened")
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP connection failed: ${e.message}")
            disconnect()
            false
        }
    }

    suspend fun listFiles(remotePath: String): List<SFTPFile> = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext emptyList()
        try {
            val vector = sftp.ls(remotePath) as Vector<ChannelSftp.LsEntry>
            vector.mapNotNull { entry ->
                val name = entry.filename
                if (name == "." || name == "..") return@mapNotNull null
                
                val attrs = entry.attrs
                val isDirectory = attrs.isDir
                val size = attrs.size
                val mTime = attrs.mTime.toLong() * 1000 // Convert seconds to ms
                val permissions = attrs.permissionsString
                
                SFTPFile(
                    name = name,
                    path = if (remotePath == "/") "/$name" else if (remotePath.endsWith("/")) "$remotePath$name" else "$remotePath/$name",
                    isDirectory = isDirectory,
                    size = size,
                    modified = mTime,
                    permissions = permissions
                )
            }.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP ls failed: ${e.message}")
            emptyList()
        }
    }

    suspend fun mkdir(remotePath: String): Boolean = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext false
        try {
            sftp.mkdir(remotePath)
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP mkdir failed: ${e.message}")
            false
        }
    }

    suspend fun delete(remotePath: String, isDirectory: Boolean): Boolean = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext false
        try {
            if (isDirectory) {
                sftp.rmdir(remotePath)
            } else {
                sftp.rm(remotePath)
            }
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP delete failed: ${e.message}")
            false
        }
    }

    suspend fun rename(oldPath: String, newPath: String): Boolean = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext false
        try {
            sftp.rename(oldPath, newPath)
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP rename failed: ${e.message}")
            false
        }
    }

    suspend fun downloadFile(remotePath: String, outputStream: OutputStream): Boolean = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext false
        try {
            outputStream.use { dst ->
                sftp.get(remotePath, dst)
            }
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP download failed: ${e.message}")
            false
        }
    }

    suspend fun uploadFile(inputStream: InputStream, remotePath: String): Boolean = withContext(Dispatchers.IO) {
        val sftp = channelSftp ?: return@withContext false
        try {
            inputStream.use { src ->
                sftp.put(src, remotePath)
            }
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP upload failed: ${e.message}")
            false
        }
    }

    suspend fun downloadToDownloads(remotePath: String, fileName: String): Boolean = withContext(Dispatchers.IO) {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val targetFile = File(downloadsDir, fileName)
        
        // If file already exists, let's rename it (e.g. file(1).txt)
        var fileToSave = targetFile
        var count = 1
        val baseName = fileName.substringBeforeLast(".")
        val extension = fileName.substringAfterLast(".", "")
        val dotExt = if (extension.isNotEmpty()) ".$extension" else ""
        
        while (fileToSave.exists()) {
            fileToSave = File(downloadsDir, "$baseName($count)$dotExt")
            count++
        }
        
        try {
            fileToSave.parentFile?.mkdirs()
            java.io.FileOutputStream(fileToSave).use { output ->
                downloadFile(remotePath, output)
            }
            true
        } catch (e: Exception) {
            DebugLog.e("SFTP", "Download to downloads folder failed: ${e.message}")
            false
        }
    }

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            channelSftp?.disconnect()
            session?.disconnect()
        } catch (e: Exception) {
            DebugLog.e("SFTP", "SFTP disconnect error: ${e.message}")
        } finally {
            channelSftp = null
            session = null
        }
    }
}
