import Foundation
import AuthenticationServices

struct PasskeyCredential: Identifiable, Decodable {
    let id: String
    let name: String?
    let created_at: String
    let last_used_at: String?
    let transports: [String]?
}

struct SamlLoginResponse: Decodable {
    let samlRequest: String
    let redirectUrl: String
    let requestId: String
}

struct WebAuthnRegisterOptions: Decodable {
    struct RP: Decodable { let id: String; let name: String }
    struct User: Decodable { let id: String; let name: String; let displayName: String }
    let rp: RP
    let user: User
    let challenge: String
}

struct WebAuthnOptionsResponse: Decodable {
    let options: WebAuthnRegisterOptions
    let challenge: String
}

@MainActor
final class SecurityService: NSObject, ObservableObject {
    static let shared = SecurityService()

    @Published var credentials: [PasskeyCredential] = []
    @Published var isLoading = false
    @Published var error: String?

    private var registrationContinuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialRegistration, Error>?
    private var credentialNameForRegistration = "Passkey"

    private override init() { super.init() }

    // MARK: - Credential management

    func fetchCredentials() async {
        guard let url = apiURL("/api/webauthn/credentials") else { return }
        isLoading = true; defer { isLoading = false }
        do {
            let data = try await get(url)
            struct Wrapper: Decodable { let credentials: [PasskeyCredential] }
            credentials = try JSONDecoder().decode(Wrapper.self, from: data).credentials
        } catch { self.error = error.localizedDescription }
    }

    func deleteCredential(id: String) async {
        guard let url = apiURL("/api/webauthn/credentials/\(id)") else { return }
        do {
            try await deleteReq(url)
            credentials.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }

    func renameCredential(id: String, name: String) async {
        guard let url = apiURL("/api/webauthn/credentials/\(id)") else { return }
        do {
            let data = try await put(url, body: ["name": name])
            if let updated = try? JSONDecoder().decode(PasskeyCredential.self, from: data) {
                credentials = credentials.map { $0.id == id ? updated : $0 }
            }
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - Passkey registration (iOS 16+)

    @available(iOS 16.0, *)
    func registerPasskey(name: String, presentingOn window: ASPresentationAnchor) async {
        guard let optURL = apiURL("/api/webauthn/register-options") else { return }
        isLoading = true; defer { isLoading = false }
        do {
            // 1. Fetch registration options from server
            let optData = try await get(optURL)
            let resp = try JSONDecoder().decode(WebAuthnOptionsResponse.self, from: optData)
            let opts = resp.options

            // 2. Decode challenge and user ID (base64url)
            guard let challengeData = Data(base64URLEncoded: opts.challenge),
                  let userIDData = Data(base64URLEncoded: opts.user.id) else {
                self.error = "Invalid challenge encoding"
                return
            }

            // 3. Start ASAuthorizationController registration
            let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: opts.rp.id)
            let request = provider.createCredentialRegistrationRequest(
                challenge: challengeData,
                name: opts.user.name,
                userID: userIDData
            )

            credentialNameForRegistration = name

            let anchorProvider = WindowAnchorProvider(window: window)
            let registration = try await withCheckedThrowingContinuation { continuation in
                self.registrationContinuation = continuation
                let controller = ASAuthorizationController(authorizationRequests: [request])
                controller.delegate = self
                controller.presentationContextProvider = anchorProvider
                controller.performRequests()
            }
            _ = anchorProvider

            // 4. Send credential to server
            let credentialId = registration.credentialID.base64URLEncodedString()
            let publicKey = registration.rawAttestationObject?.base64URLEncodedString() ?? ""

            guard let verifyURL = apiURL("/api/webauthn/register-verify") else { return }
            let body: [String: Any] = [
                "credentialId": credentialId,
                "publicKey": publicKey,
                "attestationType": "direct",
                "transports": ["internal"],
                "name": name,
            ]
            let _ = try await post(verifyURL, body: body)
            await fetchCredentials()

        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - SAML SSO

    func samlLoginURL(organizationId: String) async -> URL? {
        guard let url = apiURL("/api/saml/login?organizationId=\(organizationId)") else { return nil }
        do {
            let data = try await get(url)
            let resp = try JSONDecoder().decode(SamlLoginResponse.self, from: data)
            return URL(string: resp.redirectUrl)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    // MARK: - HTTP helpers

    private func apiURL(_ path: String) -> URL? {
        let base = APIService.shared.baseURL
        guard !base.isEmpty else { return nil }
        return URL(string: base + path)
    }

    private func get(_ url: URL) async throws -> Data {
        let req = URLRequest(url: url)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func post(_ url: URL, body: [String: Any]) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func put(_ url: URL, body: [String: Any]) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func deleteReq(_ url: URL) async throws {
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        _ = try await APIService.shared.authenticatedData(for: req)
    }
}

// MARK: - ASAuthorizationControllerDelegate

@available(iOS 16.0, *)
extension SecurityService: ASAuthorizationControllerDelegate {
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let reg = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            registrationContinuation?.resume(throwing: URLError(.badServerResponse))
            return
        }
        registrationContinuation?.resume(returning: reg)
        registrationContinuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        registrationContinuation?.resume(throwing: error)
        registrationContinuation = nil
    }
}

// MARK: - Helpers

private class WindowAnchorProvider: NSObject, ASAuthorizationControllerPresentationContextProviding {
    let window: ASPresentationAnchor
    init(window: ASPresentationAnchor) { self.window = window }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { window }
}

// MARK: - Base64URL extensions

private extension Data {
    init?(base64URLEncoded string: String) {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 { base64 += String(repeating: "=", count: 4 - remainder) }
        self.init(base64Encoded: base64)
    }

    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
