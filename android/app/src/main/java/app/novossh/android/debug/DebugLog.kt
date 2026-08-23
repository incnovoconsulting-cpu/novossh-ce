package app.novossh.android.debug

import android.util.Log
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue

data class LogEntry(
    val timestamp: Long = System.currentTimeMillis(),
    val level: String,
    val tag: String,
    val message: String,
    val details: String? = null,
)

object DebugLog {
    private val entries = ConcurrentLinkedQueue<LogEntry>()
    private val maxEntries = 200
    @Volatile var enabled = false

    fun log(level: String, tag: String, message: String, details: String? = null) {
        if (!enabled) return
        entries.add(LogEntry(level = level, tag = tag, message = message, details = details))
        while (entries.size > maxEntries) entries.poll()
        Log.d(tag, "$message ${details ?: ""}")
    }

    fun d(tag: String, msg: String, details: String? = null) = log("D", tag, msg, details)
    fun e(tag: String, msg: String, details: String? = null) = log("E", tag, msg, details)
    fun i(tag: String, msg: String, details: String? = null) = log("I", tag, msg, details)

    fun http(tag: String, method: String, url: String, status: Int? = null, body: String? = null, error: String? = null) {
        val msg = buildString {
            append("$method $url")
            if (status != null) append(" → $status")
            if (error != null) append(" ERROR: $error")
        }
        val det = buildString {
            if (body != null) append("Body: $body")
        }.ifEmpty { null }
        log(if (error != null) "E" else "I", tag, msg, det)
    }

    fun getEntries(): List<LogEntry> = entries.toList().sortedByDescending { it.timestamp }

    fun clear() = entries.clear()

    fun export(): String {
        val sdf = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
        return buildString {
            appendLine("=== NovoSSH Debug Log ===")
            appendLine("Generated: ${Date()}")
            appendLine("Entries: ${entries.size}")
            appendLine()
            for (e in getEntries()) {
                appendLine("[${sdf.format(Date(e.timestamp))}] ${e.level}/${e.tag}: ${e.message}")
                if (e.details != null) appendLine("  ${e.details}")
            }
        }
    }
}
