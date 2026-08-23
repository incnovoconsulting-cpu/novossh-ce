import Foundation

/// Syncs hosts, keys, and snippets with the NovoSSH backend.
/// Uses JWT auth stored in Keychain.
@MainActor
final class APIService: ObservableObject {
    static let shared = APIService()

    @Published var isSyncing = false
    @Published var lastSyncDate: Date?
    @Published var syncError: String?
    @Published var planLimits: PlanLimits? = PlanLimits(hosts: 3, keys: 2, snippets: 10)

    /// Production NovoSSH API. Can be overridden in Settings for self-hosted deployments.
    static let productionURL = "https://ssh.novossh.com:8787"

    var baseURL: String {
        get {
            let custom = UserDefaults.standard.string(forKey: "novossh.api.baseURL") ?? ""
            return custom.isEmpty ? Self.productionURL : custom
        }
        set { UserDefaults.standard.set(newValue, forKey: "novossh.api.baseURL") }
    }

    private var authToken: String? { KeychainService.shared.getAuthToken() }

    private init() {
        // The iOS Keychain survives app deletion, so a reinstall would otherwise
        // silently restore the previous session and skip the login screen entirely.
        // UserDefaults *is* cleared on delete — so a missing "installed" flag means
        // this is a fresh install: purge any leftover Keychain auth and start at the
        // login screen. (isLoggedIn's property initializer already read the stale
        // token above, so re-derive it after clearing.)
        let installedKey = "novossh.installed.v1"
        if !UserDefaults.standard.bool(forKey: installedKey) {
            KeychainService.shared.deleteAuthToken()
            KeychainService.shared.deleteRefreshToken()
            UserDefaults.standard.set(true, forKey: installedKey)
        }
        isLoggedIn = KeychainService.shared.getAuthToken() != nil
    }

    // MARK: - Auth

    struct LoginRequest: Codable { let email: String; let password: String }
    struct LoginResponse: Codable { let accessToken: String; let refreshToken: String? }

    func login(email: String, password: String) async throws {
        let url = try apiURL("/api/auth/login")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(LoginRequest(email: email, password: password))
        let (data, response) = try await URLSession.shared.data(for: req)
        try assertOKWithBody(response, data: data)
        let login = try JSONDecoder().decode(LoginResponse.self, from: data)
        KeychainService.shared.setAuthToken(login.accessToken)
        if let rt = login.refreshToken { KeychainService.shared.setRefreshToken(rt) }
        isLoggedIn = true
        TailscaleService.shared.prepare(accessToken: login.accessToken)
    }

    func register(name: String, email: String, password: String) async throws {
        let url = try apiURL("/api/auth/signup")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(LoginRequest(email: email, password: password))
        let (data, response) = try await URLSession.shared.data(for: req)
        try assertOKWithBody(response, data: data)
        let login = try JSONDecoder().decode(LoginResponse.self, from: data)
        KeychainService.shared.setAuthToken(login.accessToken)
        if let rt = login.refreshToken { KeychainService.shared.setRefreshToken(rt) }
        isLoggedIn = true
        TailscaleService.shared.prepare(accessToken: login.accessToken)
    }

    func forgotPassword(email: String) async throws {
        let url = try apiURL("/api/auth/forgot-password")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email])
        let (data, response) = try await URLSession.shared.data(for: req)
        try assertOKWithBody(response, data: data)
    }

    func resetPassword(token: String, password: String) async throws {
        let url = try apiURL("/api/auth/reset-password")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["token": token, "password": password])
        let (data, response) = try await URLSession.shared.data(for: req)
        try assertOKWithBody(response, data: data)
    }

    func loginWithOAuthToken(_ token: String) {
        KeychainService.shared.setAuthToken(token)
        isLoggedIn = true
        TailscaleService.shared.prepare(accessToken: token)
    }

    func logout() {
        KeychainService.shared.deleteAuthToken()
        KeychainService.shared.deleteRefreshToken()
        TailscaleService.shared.reset()
        isLoggedIn = false
    }

    /// Permanently deletes the signed-in user's account and all associated data.
    /// `password` may be empty for OAuth-only accounts (server verifies).
    func deleteAccount(password: String) async throws {
        let url = try apiURL("/api/auth/account")
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["password": password])

        let (data, response) = try await authenticatedData(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "Failed to delete account"
            throw NSError(domain: "APIService", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: message])
        }
        logout()
    }

    struct Profile: Decodable {
        let email: String
        let emailVerified: Bool
        let isOAuthAccount: Bool
        let createdAt: String
    }

    /// Fetches the signed-in user's account profile (email, verification, creation date).
    func getProfile() async throws -> Profile {
        let url = try apiURL("/api/auth/me")
        let req = URLRequest(url: url)
        let (data, response) = try await authenticatedData(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "Failed to load profile"
            throw NSError(domain: "APIService", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: message])
        }
        return try JSONDecoder().decode(Profile.self, from: data)
    }

    /// Changes the signed-in user's password. `currentPassword` may be empty for
    /// OAuth-only accounts (server verifies whether it's actually required).
    func changePassword(currentPassword: String, newPassword: String) async throws {
        let url = try apiURL("/api/auth/change-password")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["currentPassword": currentPassword, "newPassword": newPassword])

        let (data, response) = try await authenticatedData(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "Failed to change password"
            throw NSError(domain: "APIService", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: message])
        }
    }

    /// Attempts a silent token refresh using the stored refresh token.
    /// Returns the new access token on success, nil on failure.
    @discardableResult
    func refreshTokenIfNeeded() async -> String? {
        guard let url = try? apiURL("/api/auth/refresh") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Send the stored refresh token if we have one; otherwise send an empty body and
        // rely on the httpOnly refreshToken cookie URLSession captured at login. Native
        // OAuth / Sign in with Apple logins return the refresh token only as a cookie, so
        // the Keychain may be empty — without this fallback, a merely-expired access token
        // couldn't be refreshed and every request surfaced a "server error".
        if let refreshToken = KeychainService.shared.getRefreshToken() {
            req.httpBody = try? JSONEncoder().encode(["refreshToken": refreshToken])
        } else {
            req.httpBody = Data("{}".utf8)
        }
        guard let (data, response) = try? await URLSession.shared.data(for: req),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let result = try? JSONDecoder().decode(LoginResponse.self, from: data)
        else {
            // Refresh token expired — force logout
            await MainActor.run { logout() }
            return nil
        }
        KeychainService.shared.setAuthToken(result.accessToken)
        if let rt = result.refreshToken { KeychainService.shared.setRefreshToken(rt) }
        return result.accessToken
    }

    /// Verifies a native Sign in with Apple identity token with the server and
    /// signs the user in. `email` is only sent on the account's first
    /// authorization (Apple omits it from the token on subsequent sign-ins).
    func appleSignIn(identityToken: String, email: String?) async throws {
        let url = try apiURL("/api/auth/oauth/apple/verify")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        struct Body: Encodable { let identityToken: String; let email: String? }
        req.httpBody = try JSONEncoder().encode(Body(identityToken: identityToken, email: email))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "Apple sign-in failed"
            throw NSError(domain: "APIService", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: message])
        }
        let result = try JSONDecoder().decode(LoginResponse.self, from: data)
        // Store the refresh token so an expired access token can be refreshed without
        // relying on the httpOnly cookie.
        if let rt = result.refreshToken { KeychainService.shared.setRefreshToken(rt) }
        loginWithOAuthToken(result.accessToken)
    }

    /// Builds the OAuth initiation URL for the given provider.
    func oauthURL(provider: String) -> URL? {
        guard let base = URL(string: baseURL) else { return nil }
        var comps = URLComponents(url: base.appendingPathComponent("/api/auth/oauth/\(provider)"), resolvingAgainstBaseURL: false)
        comps?.queryItems = [URLQueryItem(name: "platform", value: "mobile")]
        return comps?.url
    }

    @Published var isLoggedIn: Bool = KeychainService.shared.getAuthToken() != nil

    // MARK: - Sync

    struct PlanLimits: Codable {
        var hosts: Int
        var keys: Int
        var snippets: Int
    }

    struct PreflightResult: Codable {
        var plan: String
        var limits: PlanLimits
        var usage: PlanLimits
    }

    struct SyncPayload: Codable {
        var hosts: [RemoteHost]
        var keys: [RemoteKey]
        var snippets: [RemoteSnippet]
        var plan: String?
        var planLimits: PlanLimits?
    }

    struct RemoteHost: Codable {
        var id: String
        var label: String
        var address: String
        var port: Int
        var username: String
        var authMethod: String
        var tags: [String]
        var colorHex: String?
        var notes: String?
        var lastConnectedAt: String?
        var updatedAt: String
    }

    struct RemoteKey: Codable {
        var id: String
        var label: String
        var publicKey: String?
        var hasPassphrase: Bool
        var createdAt: String
    }

    struct RemoteSnippet: Codable {
        var id: String
        var label: String
        var command: String
        var description: String?
        var tags: [String]
        var createdAt: String
    }

    /// Check plan limits and current server usage before sync.
    func preflight() async throws -> PreflightResult {
        var req = URLRequest(url: try apiURL("/api/sync/preflight"))
        let (data, response) = try await authenticatedData(for: req)
        try assertOK(response)
        return try JSONDecoder().decode(PreflightResult.self, from: data)
    }

    /// Pull latest data from server and return merged payload.
    func pull() async throws -> SyncPayload {
        let req = URLRequest(url: try apiURL("/api/sync/pull"))
        let (data, response) = try await authenticatedData(for: req)
        try assertOK(response)
        return try JSONDecoder().decode(SyncPayload.self, from: data)
    }

    /// Push local changes to server.
    func push(_ payload: SyncPayload) async throws {
        var req = URLRequest(url: try apiURL("/api/sync/push"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(payload)
        let (_, response) = try await authenticatedData(for: req)
        try assertOK(response)
    }

    // MARK: - Full sync (pull then push local)

    func sync(localHosts: [Host], localKeys: [IdentityKey], localSnippets: [Snippet]) async throws -> SyncPayload {
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }

        let iso = ISO8601DateFormatter()

        // Preflight: fetch plan limits from server before deciding what to push.
        let flight = try await preflight()
        planLimits = flight.limits
        let hostLimit = flight.limits.hosts
        let keyLimit = flight.limits.keys
        let snippetLimit = flight.limits.snippets

        // Sort by most recently updated so the newest entries are kept when over the limit.
        let hostsToSync = localHosts.sorted { $0.updatedAt > $1.updatedAt }.prefix(hostLimit)
        let keysToSync = localKeys.prefix(keyLimit)
        let snippetsToSync = localSnippets.prefix(snippetLimit)

        let payload = SyncPayload(
            hosts: hostsToSync.map { h in
                RemoteHost(
                    id: h.id.uuidString, label: h.label, address: h.address,
                    port: h.port, username: h.username, authMethod: h.authMethod.rawValue,
                    tags: h.tags, colorHex: h.colorHex, notes: h.notes,
                    lastConnectedAt: h.lastConnectedAt.map { iso.string(from: $0) },
                    updatedAt: iso.string(from: h.updatedAt)
                )
            },
            keys: keysToSync.map { k in
                RemoteKey(id: k.id.uuidString, label: k.label, publicKey: k.publicKey,
                          hasPassphrase: k.hasPassphrase, createdAt: iso.string(from: k.createdAt))
            },
            snippets: snippetsToSync.map { s in
                RemoteSnippet(id: s.id.uuidString, label: s.label, command: s.command,
                              description: s.description, tags: s.tags,
                              createdAt: iso.string(from: s.createdAt))
            }
        )

        do {
            try await push(payload)
            let remote = try await pull()
            lastSyncDate = Date()
            if let limits = remote.planLimits { planLimits = limits }
            return remote
        } catch APIError.httpError(401) {
            syncError = "Session expired. Please sign out and sign back in."
            throw APIError.httpError(401)
        } catch {
            syncError = error.localizedDescription
            throw error
        }
    }

    // MARK: - Helpers

    private func apiURL(_ path: String) throws -> URL {
        guard !baseURL.isEmpty, let url = URL(string: baseURL + path) else {
            throw APIError.notConfigured
        }
        return url
    }

    /// Returns an access token that isn't (near) expired, refreshing proactively if needed.
    ///
    /// Access tokens are short-lived (15 min) JWTs. Relying purely on "retry once after a
    /// 401" leaves a gap for call sites that read the Keychain token directly and can't
    /// retry — e.g. the SSH relay's WebSocket handshake, which authenticates once at
    /// connect time. A stale token there fails the whole connection with no recovery.
    /// Decoding the JWT payload here needs no signature verification (that's the server's
    /// job) — we're only reading `exp` to decide whether to refresh.
    func validAccessToken() async -> String? {
        guard let token = KeychainService.shared.getAuthToken() else { return nil }
        if let exp = Self.jwtExpiry(token), exp > Date().addingTimeInterval(30) {
            return token // still valid for at least 30 more seconds
        }
        return await refreshTokenIfNeeded() ?? token // fall back to the stale token if refresh fails; the caller/server will reject it explicitly rather than silently misbehaving
    }

    private static func jwtExpiry(_ token: String) -> Date? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var base64 = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? Double else { return nil }
        return Date(timeIntervalSince1970: exp)
    }

    /// Execute an authenticated URLRequest, proactively refreshing a (near-)expired token
    /// and retrying once more after a silent refresh if the server still returns 401
    /// (e.g. the token was revoked out-of-band).
    func authenticatedData(for request: URLRequest) async throws -> (Data, URLResponse) {
        var req = request
        req.setValue("Bearer \(await validAccessToken() ?? "")", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 401 else { return (data, response) }
        // Attempt silent refresh
        guard let newToken = await refreshTokenIfNeeded() else { throw APIError.httpError(401) }
        req.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
        return try await URLSession.shared.data(for: req)
    }

    private func assertOK(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { logout() }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpError(http.statusCode)
        }
    }

    // Like assertOK but extracts the server's error message from the JSON body
    private func assertOKWithBody(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { logout() }
        guard (200..<300).contains(http.statusCode) else {
            if let json = try? JSONDecoder().decode([String: String].self, from: data),
               let msg = json["error"] ?? json["message"] {
                throw APIError.serverMessage(msg)
            }
            throw APIError.httpError(http.statusCode)
        }
    }
}

enum APIError: Error, LocalizedError {
    case notConfigured
    case invalidResponse
    case httpError(Int)
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "API server URL not configured. Set it in Settings."
        case .invalidResponse: return "Invalid server response."
        case .httpError(let code): return "Server error (HTTP \(code))."
        case .serverMessage(let msg): return msg
        }
    }
}
