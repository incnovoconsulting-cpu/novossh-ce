package app.novossh.android.viewmodel

import android.app.Application
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.NovoSSHApp
import app.novossh.android.data.VaultEncryption
import app.novossh.android.models.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private val android.content.Context.dataStore: DataStore<Preferences> by preferencesDataStore("settings")

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as NovoSSHApp
    private val db = app.database
    private val secure = app.secureStorage

    val hosts: StateFlow<List<Host>> = db.hostDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val keys: StateFlow<List<IdentityKey>> = db.identityKeyDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val snippets: StateFlow<List<Snippet>> = db.snippetDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val snippetPackages: StateFlow<List<SnippetPackage>> = db.snippetPackageDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sessionLogs: StateFlow<List<SessionLog>> = db.sessionLogDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val vaults: StateFlow<List<Vault>> = db.vaultDao().getAllVaults()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _settings = MutableStateFlow(UserSettings())
    val settings: StateFlow<UserSettings> = _settings.asStateFlow()

    init {
        viewModelScope.launch { loadSettings() }
    }

    private suspend fun loadSettings() {
        val ds = app.dataStore.data.first()
        _settings.value = UserSettings(
            themeId = ds[stringPreferencesKey("themeId")] ?: "novo-dark",
            terminalScheme = ds[stringPreferencesKey("terminalScheme")] ?: "novo-dark",
            fontSize = ds[intPreferencesKey("fontSize")] ?: 14,
            fontFamily = ds[stringPreferencesKey("fontFamily")] ?: "Monospace",
            cursorBlink = ds[booleanPreferencesKey("cursorBlink")] ?: true,
            copyOnSelect = ds[booleanPreferencesKey("copyOnSelect")] ?: false,
            scrollback = ds[intPreferencesKey("scrollback")] ?: 5000,
            keepAliveSeconds = ds[intPreferencesKey("keepAliveSeconds")] ?: 30,
            bellSound = ds[booleanPreferencesKey("bellSound")] ?: false,
            biometricLock = ds[booleanPreferencesKey("biometricLock")] ?: false,
            hasSeenOnboarding = ds[booleanPreferencesKey("hasSeenOnboarding")] ?: false,
            keyboardButtons = ds[stringPreferencesKey("keyboardButtons")] ?: "Tab,Esc,^C,^D,^Z,↑,↓,←,→,Home,End,PgUp,PgDn,|,/,~,-",
            sendOnEnter = ds[booleanPreferencesKey("sendOnEnter")] ?: true,
        )
    }

    // Host operations
    fun addHost(host: Host, password: String?) = viewModelScope.launch {
        if (password != null) secure.put("pw_${host.id}", password)
        db.hostDao().insert(host)
    }

    fun updateHost(host: Host, password: String?) = viewModelScope.launch {
        if (password != null) secure.put("pw_${host.id}", password)
        db.hostDao().update(host.copy(updatedAt = System.currentTimeMillis()))
    }

    fun deleteHost(id: String) = viewModelScope.launch {
        secure.delete("pw_$id")
        db.hostDao().delete(id)
    }

    fun touchHost(id: String) = viewModelScope.launch { db.hostDao().touch(id) }

    fun getPassword(host: Host): String? = secure.get("pw_${host.id}")

    // Key operations
    fun addKey(key: IdentityKey, privateKeyPem: String) = viewModelScope.launch {
        secure.put("key_${key.id}", privateKeyPem)
        db.identityKeyDao().insert(key)
    }

    fun deleteKey(id: String) = viewModelScope.launch {
        secure.delete("key_$id")
        db.identityKeyDao().delete(id)
    }

    fun getPrivateKey(key: IdentityKey): String? = secure.get("key_${key.id}")

    // Snippet operations
    fun addSnippet(snippet: Snippet) = viewModelScope.launch { db.snippetDao().insert(snippet) }
    fun deleteSnippet(id: String) = viewModelScope.launch { db.snippetDao().delete(id) }

    // Snippet package operations
    fun addSnippetPackage(pkg: SnippetPackage) = viewModelScope.launch { db.snippetPackageDao().insert(pkg) }
    fun deleteSnippetPackage(id: String) = viewModelScope.launch { db.snippetPackageDao().delete(id) }

    // Session log operations
    fun addSessionLog(log: SessionLog) = viewModelScope.launch { db.sessionLogDao().insert(log) }
    fun bookmarkLog(id: String, comment: String?) = viewModelScope.launch {
        db.sessionLogDao().updateBookmark(id, true, comment)
    }
    fun unbookmarkLog(id: String) = viewModelScope.launch {
        db.sessionLogDao().updateBookmark(id, false)
    }

    // Auth
    fun getAuthToken(): String? = secure.get("auth_token")

    private suspend fun refreshAccessToken(): String? = withContext(Dispatchers.IO) {
        val refreshToken = secure.get("auth_refresh_token") ?: return@withContext null
        val base = getApiBaseUrl().trimEnd('/')
        try {
            val conn = (URL("$base/api/auth/refresh").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true; connectTimeout = 15000; readTimeout = 15000
            }
            conn.outputStream.buffered().use {
                it.write(JSONObject().apply { put("refreshToken", refreshToken) }.toString().toByteArray())
            }
            if (conn.responseCode == 200) {
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                val newToken = json.getString("accessToken")
                secure.put("auth_token", newToken)
                json.optString("refreshToken").takeIf { it.isNotEmpty() }
                    ?.let { secure.put("auth_refresh_token", it) }
                conn.disconnect()
                newToken
            } else { conn.disconnect(); null }
        } catch (_: Exception) { null }
    }

    // Settings
    fun updateSettings(s: UserSettings) {
        _settings.value = s
        viewModelScope.launch {
            app.dataStore.edit { prefs ->
                prefs[stringPreferencesKey("themeId")] = s.themeId
                prefs[stringPreferencesKey("terminalScheme")] = s.terminalScheme
                prefs[intPreferencesKey("fontSize")] = s.fontSize
                prefs[stringPreferencesKey("fontFamily")] = s.fontFamily
                prefs[booleanPreferencesKey("cursorBlink")] = s.cursorBlink
                prefs[booleanPreferencesKey("copyOnSelect")] = s.copyOnSelect
                prefs[intPreferencesKey("scrollback")] = s.scrollback
                prefs[intPreferencesKey("keepAliveSeconds")] = s.keepAliveSeconds
                prefs[booleanPreferencesKey("bellSound")] = s.bellSound
                prefs[booleanPreferencesKey("biometricLock")] = s.biometricLock
                prefs[booleanPreferencesKey("hasSeenOnboarding")] = s.hasSeenOnboarding
                prefs[stringPreferencesKey("keyboardButtons")] = s.keyboardButtons
                prefs[booleanPreferencesKey("sendOnEnter")] = s.sendOnEnter
            }
        }
    }

    // Vault operations
    fun getVaultEntries(vaultId: String): Flow<List<VaultEntry>> = db.vaultDao().getEntriesForVault(vaultId)
        .map { entries ->
            entries.map { entry ->
                entry.copy(
                    encryptedData = VaultEncryption.decryptEntryData(entry.encryptedData)
                )
            }
        }

    fun createVault(name: String, description: String?) = viewModelScope.launch {
        val vault = Vault(name = name, description = description)
        db.vaultDao().insertVault(vault)
    }

    fun deleteVault(vault: Vault) = viewModelScope.launch {
        db.vaultDao().deleteVault(vault)
    }

    fun createVaultEntry(vaultId: String, type: String, name: String, data: String) = viewModelScope.launch {
        val encryptedData = VaultEncryption.encryptEntryData(data)
        val entry = VaultEntry(vaultId = vaultId, type = type, name = name, encryptedData = encryptedData)
        db.vaultDao().insertEntry(entry)
        db.vaultDao().updateVaultTimestamp(vaultId, System.currentTimeMillis())
    }

    fun deleteVaultEntry(id: String) = viewModelScope.launch {
        db.vaultDao().deleteEntryById(id)
    }

    // Onboarding
    fun hasCompletedOnboarding(): Boolean = secure.get("onboarding_done") == "true"

    fun completeOnboarding() {
        secure.put("onboarding_done", "true")
    }

    // PIN lock
    fun savePin(pin: String) {
        val hash = java.security.MessageDigest.getInstance("SHA-256")
            .digest(pin.toByteArray())
            .joinToString("") { "%02x".format(it) }
        secure.put("pin_hash", hash)
    }

    fun validatePin(pin: String): Boolean {
        val storedHash = secure.get("pin_hash") ?: return false
        val hash = java.security.MessageDigest.getInstance("SHA-256")
            .digest(pin.toByteArray())
            .joinToString("") { "%02x".format(it) }
        return hash == storedHash
    }

    fun isPinSet(): Boolean = secure.get("pin_hash") != null

    // Vault lock
    private val _lockedVaults = MutableStateFlow<Set<String>>(emptySet())
    val lockedVaults: StateFlow<Set<String>> = _lockedVaults.asStateFlow()

    fun isVaultLocked(vaultId: String): Boolean = _lockedVaults.value.contains(vaultId)
    fun unlockVault(vaultId: String) { _lockedVaults.value = _lockedVaults.value + vaultId }
    fun lockVault(vaultId: String) { _lockedVaults.value = _lockedVaults.value - vaultId }

    // Broadcast input — emits text to all listening terminal sessions
    private val _broadcastFlow = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val broadcastFlow: SharedFlow<String> = _broadcastFlow.asSharedFlow()

    fun broadcast(text: String) {
        viewModelScope.launch { _broadcastFlow.emit(text) }
    }

    // Sync
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()
    private val _lastSyncTime = MutableStateFlow<Long?>(null)
    val lastSyncTime: StateFlow<Long?> = _lastSyncTime.asStateFlow()
    private val _syncError = MutableStateFlow<String?>(null)
    val syncError: StateFlow<String?> = _syncError.asStateFlow()

    fun getApiBaseUrl(): String = secure.get("api_base_url") ?: "https://ssh.novossh.com:8787"
    fun setApiBaseUrl(url: String) { secure.put("api_base_url", url) }

    fun syncNow() {
        var token = getAuthToken() ?: run { _syncError.value = "Not signed in"; return }
        val base = getApiBaseUrl().trimEnd('/')
        if (base.isEmpty()) { _syncError.value = "API server URL not configured"; return }
        val isoFmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        viewModelScope.launch {
            _isSyncing.value = true
            _syncError.value = null
            try {
                withContext(Dispatchers.IO) {
                    // Refresh token if expired before starting sync
                    fun makeConn(path: String) = (URL("$base$path").openConnection() as HttpURLConnection).apply {
                        setRequestProperty("Authorization", "Bearer $token")
                        connectTimeout = 15000; readTimeout = 15000
                    }

                    // Preflight: get plan limits before deciding what to push
                    var preConn = makeConn("/api/sync/preflight")
                    if (preConn.responseCode == 401) {
                        token = refreshAccessToken() ?: run { _syncError.value = "Session expired"; return@withContext }
                        preConn = makeConn("/api/sync/preflight")
                    }
                    val hostLimit: Int
                    val keyLimit: Int
                    val snippetLimit: Int
                    if (preConn.responseCode == 200) {
                        val preBody = preConn.inputStream.bufferedReader().readText()
                        if (preBody.isBlank()) throw java.io.IOException("Empty response from server during preflight")
                        val pre = JSONObject(preBody)
                        val limits = pre.optJSONObject("limits")
                        hostLimit = limits?.optInt("hosts", 3) ?: 3
                        keyLimit = limits?.optInt("keys", 2) ?: 2
                        snippetLimit = limits?.optInt("snippets", 10) ?: 10
                    } else {
                        hostLimit = 3; keyLimit = 2; snippetLimit = 10
                    }
                    preConn.disconnect()

                    // Cap local data to plan limits (newest-first for hosts)
                    val hostsToSync = hosts.value.sortedByDescending { it.updatedAt }.take(hostLimit)
                    val keysToSync = keys.value.take(keyLimit)
                    val snippetsToSync = snippets.value.take(snippetLimit)

                    val hostsJson = org.json.JSONArray().apply {
                        hostsToSync.forEach { h ->
                            put(JSONObject().apply {
                                put("id", h.id); put("label", h.label); put("address", h.address)
                                put("port", h.port); put("username", h.username)
                                put("authMethod", h.authMethod); put("tags", org.json.JSONArray(h.tags))
                                put("updatedAt", isoFmt.format(java.util.Date(h.updatedAt)))
                            })
                        }
                    }
                    val snippetsJson = org.json.JSONArray().apply {
                        snippetsToSync.forEach { s ->
                            put(JSONObject().apply {
                                put("id", s.id); put("label", s.label); put("command", s.command)
                                put("tags", org.json.JSONArray(s.tags))
                                put("createdAt", isoFmt.format(java.util.Date(s.createdAt)))
                            })
                        }
                    }
                    val keysJson = org.json.JSONArray().apply {
                        keysToSync.forEach { k ->
                            put(JSONObject().apply {
                                put("id", k.id); put("label", k.label)
                                put("publicKey", k.publicKey ?: ""); put("hasPassphrase", k.hasPassphrase)
                                put("createdAt", isoFmt.format(java.util.Date(k.createdAt)))
                            })
                        }
                    }
                    val pushBody = JSONObject().apply {
                        put("hosts", hostsJson); put("keys", keysJson); put("snippets", snippetsJson)
                    }.toString().toByteArray()

                    var conn = makeConn("/api/sync/push").apply {
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json")
                        doOutput = true
                    }
                    conn.outputStream.buffered().use { it.write(pushBody) }
                    conn.responseCode
                    conn.disconnect()

                    // Pull remote and merge with deduplication
                    conn = makeConn("/api/sync/pull")
                    if (conn.responseCode == 200) {
                        val raw = conn.inputStream.bufferedReader().readText()
                        if (raw.isBlank()) throw java.io.IOException("Empty response from server during sync")
                        val resp = JSONObject(raw)
                        val remoteHosts = resp.optJSONArray("hosts")
                        val currentHosts = hosts.value
                        if (remoteHosts != null) {
                            for (i in 0 until remoteHosts.length()) {
                                val rh = remoteHosts.getJSONObject(i)
                                val id = rh.getString("id")
                                val address = rh.getString("address")
                                val port = rh.optInt("port", 22)
                                val username = rh.optString("username", "root")
                                val remoteUpdatedAt = try {
                                    isoFmt.parse(rh.optString("updatedAt", ""))?.time ?: System.currentTimeMillis()
                                } catch (_: Exception) { System.currentTimeMillis() }

                                val byId = currentHosts.find { it.id == id }
                                if (byId != null) {
                                    // UUID match — update if remote is newer
                                    if (remoteUpdatedAt > byId.updatedAt) {
                                        db.hostDao().update(byId.copy(
                                            label = rh.getString("label"),
                                            address = address, port = port, username = username,
                                            authMethod = try { AuthMethod.valueOf(rh.optString("authMethod", "PASSWORD").uppercase()) } catch (_: Exception) { AuthMethod.PASSWORD },
                                            updatedAt = remoteUpdatedAt
                                        ))
                                    }
                                } else {
                                    val byAddress = currentHosts.find {
                                        it.address == address && it.username == username && it.port == port
                                    }
                                    if (byAddress != null) {
                                        // Same host, different UUID — adopt server UUID and update if newer
                                        if (remoteUpdatedAt > byAddress.updatedAt) {
                                            db.hostDao().delete(byAddress.id)
                                            db.hostDao().insert(byAddress.copy(
                                                id = id,
                                                label = rh.getString("label"),
                                                authMethod = try { AuthMethod.valueOf(rh.optString("authMethod", "PASSWORD").uppercase()) } catch (_: Exception) { AuthMethod.PASSWORD },
                                                updatedAt = remoteUpdatedAt
                                            ))
                                        } else {
                                            db.hostDao().delete(byAddress.id)
                                            db.hostDao().insert(byAddress.copy(id = id))
                                        }
                                    } else {
                                        db.hostDao().insert(Host(
                                            id = id, label = rh.getString("label"),
                                            address = address, port = port, username = username,
                                            authMethod = try { AuthMethod.valueOf(rh.optString("authMethod", "PASSWORD").uppercase()) } catch (_: Exception) { AuthMethod.PASSWORD },
                                            updatedAt = remoteUpdatedAt
                                        ))
                                    }
                                }
                            }
                        }
                    }
                    conn.disconnect()
                }
                _lastSyncTime.value = System.currentTimeMillis()
            } catch (e: Exception) {
                _syncError.value = e.message ?: "Sync failed"
            } finally {
                _isSyncing.value = false
            }
        }
    }
}
