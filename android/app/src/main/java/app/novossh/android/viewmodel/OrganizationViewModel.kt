package app.novossh.android.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.novossh.android.data.SecureStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Organization(
    val id: String,
    val name: String,
    val slug: String,
    val description: String?,
    val logo_url: String?,
    val parent_id: String?,
    val created_at: String,
)

data class OrgMember(
    val id: String,
    val userId: String,
    val role: String,
    val email: String?,
    val username: String?,
)

data class Team(
    val id: String,
    val name: String,
    val description: String?,
    val organizationId: String?,
)

class OrganizationViewModel(app: Application) : AndroidViewModel(app) {
    private val secure = SecureStorage(app)

    private val _organizations = MutableStateFlow<List<Organization>>(emptyList())
    val organizations: StateFlow<List<Organization>> = _organizations

    private val _members = MutableStateFlow<List<OrgMember>>(emptyList())
    val members: StateFlow<List<OrgMember>> = _members

    private val _teams = MutableStateFlow<List<Team>>(emptyList())
    val teams: StateFlow<List<Team>> = _teams

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun clearError() { _error.value = null }

    // MARK: - Organizations

    fun fetchOrganizations() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val data = get("/api/organizations")
                val obj = JSONObject(data)
                val arr = obj.getJSONArray("organizations")
                _organizations.value = (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    Organization(
                        id = o.getString("id"),
                        name = o.getString("name"),
                        slug = o.getString("slug"),
                        description = o.optString("description").ifEmpty { null },
                        logo_url = o.optString("logo_url").ifEmpty { null },
                        parent_id = o.optString("parent_id").ifEmpty { null },
                        created_at = o.optString("created_at"),
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun createOrganization(name: String, slug: String, description: String?, onSuccess: (Organization) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val body = JSONObject().apply {
                    put("name", name); put("slug", slug)
                    if (description != null) put("description", description)
                }
                val data = post("/api/organizations", body)
                val o = JSONObject(data)
                val org = Organization(
                    id = o.getString("id"), name = o.getString("name"),
                    slug = o.getString("slug"), description = o.optString("description").ifEmpty { null },
                    logo_url = null, parent_id = null, created_at = o.optString("created_at"),
                )
                _organizations.value = _organizations.value + org
                onSuccess(org)
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateOrganization(id: String, name: String, description: String?) {
        viewModelScope.launch {
            try {
                val body = JSONObject().apply {
                    put("name", name)
                    if (description != null) put("description", description)
                }
                val data = patch("/api/organizations/$id", body)
                val o = JSONObject(data)
                val updated = Organization(
                    id = o.getString("id"), name = o.getString("name"),
                    slug = o.getString("slug"), description = o.optString("description").ifEmpty { null },
                    logo_url = null, parent_id = null, created_at = o.optString("created_at"),
                )
                _organizations.value = _organizations.value.map { if (it.id == id) updated else it }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun deleteOrganization(id: String) {
        viewModelScope.launch {
            try {
                delete("/api/organizations/$id")
                _organizations.value = _organizations.value.filter { it.id != id }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    // MARK: - Members

    fun fetchMembers(orgId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val data = get("/api/organizations/$orgId/members")
                val obj = JSONObject(data)
                val arr = obj.getJSONArray("members")
                _members.value = (0 until arr.length()).map { i ->
                    val m = arr.getJSONObject(i)
                    OrgMember(
                        id = m.getString("id"),
                        userId = m.optString("userId"),
                        role = m.getString("role"),
                        email = m.optString("email").ifEmpty { null },
                        username = m.optString("username").ifEmpty { null },
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun removeMember(orgId: String, memberId: String) {
        viewModelScope.launch {
            try {
                delete("/api/organizations/$orgId/members/$memberId")
                _members.value = _members.value.filter { it.id != memberId }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun updateMemberRole(orgId: String, memberId: String, role: String) {
        viewModelScope.launch {
            try {
                val body = JSONObject().apply { put("role", role) }
                patch("/api/organizations/$orgId/members/$memberId", body)
                _members.value = _members.value.map {
                    if (it.id == memberId) it.copy(role = role) else it
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    // MARK: - Teams

    fun fetchTeams() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val data = get("/api/teams")
                val arr = JSONArray(data)
                _teams.value = (0 until arr.length()).map { i ->
                    val t = arr.getJSONObject(i)
                    Team(
                        id = t.getString("id"),
                        name = t.getString("name"),
                        description = t.optString("description").ifEmpty { null },
                        organizationId = t.optString("organizationId").ifEmpty { null },
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun createTeam(name: String, description: String?, onSuccess: (Team) -> Unit) {
        viewModelScope.launch {
            try {
                val body = JSONObject().apply {
                    put("name", name)
                    if (description != null) put("description", description)
                }
                val data = post("/api/teams", body)
                val t = JSONObject(data)
                val team = Team(
                    id = t.getString("id"), name = t.getString("name"),
                    description = t.optString("description").ifEmpty { null },
                    organizationId = t.optString("organizationId").ifEmpty { null },
                )
                _teams.value = _teams.value + team
                onSuccess(team)
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun deleteTeam(id: String) {
        viewModelScope.launch {
            try {
                delete("/api/teams/$id")
                _teams.value = _teams.value.filter { it.id != id }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    // MARK: - HTTP helpers

    private fun baseUrl(): String = secure.get("api_base_url") ?: "https://ssh.novossh.com:8787"
    private fun token(): String = secure.get("auth_token") ?: ""

    private suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun post(path: String, body: JSONObject): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun patch(path: String, body: JSONObject): String = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "PATCH"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }

    private suspend fun delete(path: String): Unit = withContext(Dispatchers.IO) {
        val conn = URL(baseUrl() + path).openConnection() as HttpURLConnection
        conn.requestMethod = "DELETE"
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        conn.responseCode // trigger request
    }
}
