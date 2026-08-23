package app.novossh.android.analytics

import android.os.Bundle
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.analytics.ktx.logEvent
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase

/**
 * Helper for Firebase Analytics and Crashlytics.
 * All tracking respects user privacy — no PII is collected.
 */
object AnalyticsHelper {

    /**
     * Log a custom analytics event.
     */
    fun logEvent(name: String, params: Map<String, String> = emptyMap()) {
        try {
            Firebase.analytics.logEvent(name) {
                params.forEach { (key, value) -> param(key, value) }
            }
        } catch (e: Exception) {
            // Silently fail — analytics should never crash the app
        }
    }

    /**
     * Log SSH connection attempt.
     */
    fun logConnection(mode: String, success: Boolean) {
        logEvent("ssh_connection", mapOf(
            "mode" to mode,
            "success" to success.toString()
        ))
    }

    /**
     * Log host creation.
     */
    fun logHostCreated(authMethod: String) {
        logEvent("host_created", mapOf("auth_method" to authMethod))
    }

    /**
     * Log SFTP operation.
     */
    fun logSftpOp(operation: String) {
        logEvent("sftp_operation", mapOf("operation" to operation))
    }

    /**
     * Log feature usage.
     */
    fun logFeatureUsed(feature: String) {
        logEvent("feature_used", mapOf("feature" to feature))
    }

    /**
     * Set user ID for crash reports (non-PII).
     */
    fun setUserId(userId: String) {
        try {
            // Hash the user ID so it's not PII
            val hashed = java.security.MessageDigest.getInstance("SHA-256")
                .digest(userId.toByteArray())
                .joinToString("") { "%02x".format(it) }
                .take(16)
            Firebase.crashlytics.setUserId(hashed)
        } catch (e: Exception) {
            // Silently fail
        }
    }

    /**
     * Log a non-fatal error to Crashlytics.
     */
    fun logError(throwable: Throwable, message: String? = null) {
        try {
            if (message != null) {
                Firebase.crashlytics.recordException(throwable)
                Firebase.crashlytics.log(message)
            } else {
                Firebase.crashlytics.recordException(throwable)
            }
        } catch (e: Exception) {
            // Silently fail
        }
    }
}
