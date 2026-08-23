import SwiftUI
import AuthenticationServices

struct AuthView: View {
    @EnvironmentObject private var api: APIService
    @State private var mode: Mode = .login
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showForgotPassword = false

    enum Mode: Hashable { case login, signup }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 28) {
                    // Logo
                    VStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .fill(Theme.accent.opacity(0.12))
                                .frame(width: 72, height: 72)
                            Image(systemName: "terminal.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(Theme.accent)
                        }
                        Text("NovoSSH")
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.textStrong)
                        Text("Secure SSH for iOS")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)

                    // OAuth buttons
                    VStack(spacing: 10) {
                        SignInWithAppleButton(.signIn, onRequest: configureAppleRequest, onCompletion: handleAppleCompletion)
                            .signInWithAppleButtonStyle(.white)
                            .frame(height: 50)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        OAuthButton(label: "Continue with GitHub", systemIcon: "chevron.left.forwardslash.chevron.right") {
                            startOAuth(provider: "github")
                        }
                        OAuthButton(label: "Continue with Google", systemIcon: "globe") {
                            startOAuth(provider: "google")
                        }
                    }
                    .padding(.horizontal, 24)

                    // Divider
                    HStack {
                        Rectangle().fill(Theme.stroke).frame(height: 1)
                        Text("or").font(.caption).foregroundStyle(Theme.textMuted).padding(.horizontal, 8)
                        Rectangle().fill(Theme.stroke).frame(height: 1)
                    }
                    .padding(.horizontal, 24)

                    // Mode toggle
                    HStack(spacing: 0) {
                        ForEach([Mode.login, Mode.signup], id: \.self) { m in
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) { mode = m }
                                errorMessage = nil
                            } label: {
                                Text(m == .login ? "Sign In" : "Sign Up")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(mode == m ? Theme.bg : Theme.textMuted)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(
                                        Group {
                                            if mode == m {
                                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                    .fill(Theme.accent)
                                                    .padding(3)
                                            }
                                        }
                                    )
                            }
                        }
                    }
                    .background(Theme.panel)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.stroke))
                    .padding(.horizontal, 24)

                    // Fields
                    VStack(spacing: 14) {
                        if mode == .signup {
                            AuthField(title: "Full Name", text: $name, icon: "person", contentType: .name)
                        }
                        AuthField(title: "Email", text: $email, icon: "envelope", contentType: .emailAddress, keyboard: .emailAddress)
                        AuthField(title: "Password", text: $password, icon: "lock", contentType: mode == .login ? .password : .newPassword, secure: true)
                        if mode == .signup {
                            AuthField(title: "Confirm Password", text: $confirmPassword, icon: "lock.fill", contentType: .newPassword, secure: true)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Error
                    if let err = errorMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(.horizontal, 28)
                    }

                    // Submit
                    Button(action: submit) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Theme.accent)
                            if isLoading {
                                ProgressView().tint(Theme.bg)
                            } else {
                                Text(mode == .login ? "Sign In" : "Create Account")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(Theme.bg)
                            }
                        }
                        .frame(height: 50)
                    }
                    .disabled(isLoading || !isValid)
                    .opacity(isValid ? 1 : 0.5)
                    .padding(.horizontal, 24)

                    // Forgot password (login only)
                    if mode == .login {
                        Button { showForgotPassword = true } label: {
                            Text("Forgot password?")
                                .font(.subheadline)
                                .foregroundStyle(Theme.accent)
                        }
                    }

                    // Footer toggle
                    Button {
                        withAnimation { mode = mode == .login ? .signup : .login }
                        errorMessage = nil
                    } label: {
                        Text(mode == .login ? "Don't have an account? " : "Already have an account? ")
                            .foregroundStyle(Theme.textMuted)
                        + Text(mode == .login ? "Sign Up" : "Sign In")
                            .foregroundStyle(Theme.accent)
                    }
                    .font(.subheadline)

                    // Support link
                    Button {
                        if let url = URL(string: "mailto:support@novossh.com") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Text("Need help? ")
                            .foregroundStyle(Theme.textMuted)
                        + Text("Contact Support")
                            .foregroundStyle(Theme.accent)
                    }
                    .font(.caption)

                    Spacer(minLength: 40)
                }
            }
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
                .environmentObject(api)
        }
    }

    private var isValid: Bool {
        !email.isEmpty && !password.isEmpty &&
        (mode == .login || (!name.isEmpty && confirmPassword == password && password.count >= 8))
    }

    private func submit() {
        errorMessage = nil
        isLoading = true
        Task {
            do {
                if mode == .login {
                    try await api.login(email: email, password: password)
                } else {
                    guard password == confirmPassword else {
                        errorMessage = "Passwords don't match"
                        isLoading = false
                        return
                    }
                    guard password.count >= 8 else {
                        errorMessage = "Password must be at least 8 characters"
                        isLoading = false
                        return
                    }
                    try await api.register(name: name, email: email, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        request.requestedScopes = [.email]
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8) else {
                errorMessage = "Apple sign-in did not return a valid token"
                return
            }
            isLoading = true
            Task {
                do {
                    try await api.appleSignIn(identityToken: identityToken, email: credential.email)
                } catch {
                    errorMessage = error.localizedDescription
                }
                isLoading = false
            }
        case .failure(let error):
            let nsError = error as NSError
            // User cancelled — not an error worth surfacing.
            if nsError.domain == ASAuthorizationError.errorDomain, nsError.code == ASAuthorizationError.canceled.rawValue {
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func startOAuth(provider: String) {
        guard let url = api.oauthURL(provider: provider) else { return }
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: "novossh"
        ) { callbackURL, _ in
            guard let callbackURL else { return }
            let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
            if let token = components?.queryItems?.first(where: { $0.name == "oauth_token" })?.value {
                Task { @MainActor in api.loginWithOAuthToken(token) }
            } else if let errMsg = components?.queryItems?.first(where: { $0.name == "oauth_error" })?.value {
                Task { @MainActor in errorMessage = "Sign in failed: \(errMsg.replacingOccurrences(of: "_", with: " "))" }
            }
        }
        session.prefersEphemeralWebBrowserSession = false
        session.presentationContextProvider = OAuthContextProvider.shared
        session.start()
    }
}

private final class OAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = OAuthContextProvider()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

private struct OAuthButton: View {
    let label: String
    let systemIcon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemIcon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Theme.textMuted)
                    .frame(width: 24)
                Text(label)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.textStrong)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 50)
            .background(Theme.panel)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.stroke))
        }
    }
}

private struct AuthField: View {
    let title: String
    @Binding var text: String
    let icon: String
    var contentType: UITextContentType? = nil
    var keyboard: UIKeyboardType = .default
    var secure: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Theme.textMuted)
                .frame(width: 20)
            Group {
                if secure {
                    SecureField(title, text: $text)
                } else {
                    TextField(title, text: $text)
                        .keyboardType(keyboard)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
            }
            .foregroundStyle(Theme.textStrong)
            .textContentType(contentType)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.stroke))
    }
}
