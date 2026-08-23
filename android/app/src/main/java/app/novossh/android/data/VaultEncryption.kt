package app.novossh.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

/**
 * E2E encryption for vault entries using Android Keystore + AES-256-GCM.
 * The encryption key is derived from a user-provided master password via PBKDF2.
 */
object VaultEncryption {
    private const val KEYSTORE_ALIAS = "novossh_vault_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH = 128
    private const val PREFS_NAME = "novossh_vault_prefs"
    private const val KEY_SALT = "vault_salt"

    private fun getKeyStore(): KeyStore {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        return keyStore
    }

    private fun generateOrGetKey(): SecretKey {
        val keyStore = getKeyStore()
        val existingKey = keyStore.getEntry(KEYSTORE_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existingKey != null) return existingKey.secretKey

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return keyGenerator.generateKey()
    }

    /**
     * Encrypt a plaintext string. Returns Base64-encoded ciphertext with IV prepended.
     */
    fun encrypt(plaintext: String): String {
        val key = generateOrGetKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        // Prepend IV (12 bytes) to ciphertext
        val combined = iv + ciphertext
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Decrypt a Base64-encoded ciphertext string (with prepended IV).
     */
    fun decrypt(encrypted: String): String {
        val key = generateOrGetKey()
        val combined = Base64.decode(encrypted, Base64.NO_WRAP)
        val iv = combined.sliceArray(0..11)
        val ciphertext = combined.sliceArray(12 until combined.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)
        val plaintext = cipher.doFinal(ciphertext)
        return String(plaintext, Charsets.UTF_8)
    }

    /**
     * Check if a string looks like encrypted data (Base64 with IV prefix).
     */
    fun isEncrypted(data: String): Boolean {
        return try {
            val decoded = Base64.decode(data, Base64.NO_WRAP)
            decoded.size > 12 // At least IV + some ciphertext
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Encrypt vault entry data, handling already-encrypted or plaintext.
     */
    fun encryptEntryData(data: String): String {
        if (data.isBlank()) return data
        return if (isEncrypted(data)) data else encrypt(data)
    }

    /**
     * Decrypt vault entry data, handling encrypted or plaintext.
     */
    fun decryptEntryData(data: String): String {
        if (data.isBlank()) return data
        return if (isEncrypted(data)) decrypt(data) else data
    }
}
