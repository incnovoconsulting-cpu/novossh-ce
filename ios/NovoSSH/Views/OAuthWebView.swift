import SwiftUI
import WebKit

#if os(iOS)
struct OAuthWebView: UIViewRepresentable {
    let url: String
    let onTokenReceived: (String, TimeInterval) -> Void
    let onError: (String) -> Void
    let onDismiss: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        if let requestUrl = URL(string: url) {
            webView.load(URLRequest(url: requestUrl))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, WKNavigationDelegate {
        let parent: OAuthWebView
        init(_ parent: OAuthWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.allow); return }

            let host = url.host ?? ""
            let allowedHosts = ["novossh.com", "github.com", "accounts.google.com"]
            let isAllowed = allowedHosts.contains(host) || host.hasSuffix(".novossh.com") || host.hasSuffix(".github.com") || host.hasSuffix(".google.com")

            if !isAllowed {
                parent.onError("Blocked navigation to \(host)")
                decisionHandler(.cancel)
                return
            }

            let urlString = url.absoluteString
            if let components = URLComponents(string: urlString),
               let items = components.queryItems {
                if let token = items.first(where: { $0.name == "oauth_token" })?.value,
                   let expiresStr = items.first(where: { $0.name == "oauth_expires" })?.value,
                   let expires = TimeInterval(expiresStr) {
                    parent.onTokenReceived(token, expires)
                    decisionHandler(.cancel)
                    return
                }
                if let error = items.first(where: { $0.name == "oauth_error" })?.value {
                    parent.onError(error)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let http = navigationResponse.response as? HTTPURLResponse, http.statusCode == 429 {
                parent.onError("Too many sign-in attempts. Please wait a moment and try again.")
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
#elseif os(macOS)
struct OAuthWebView: NSViewRepresentable {
    let url: String
    let onTokenReceived: (String, TimeInterval) -> Void
    let onError: (String) -> Void
    let onDismiss: () -> Void

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        if let requestUrl = URL(string: url) {
            webView.load(URLRequest(url: requestUrl))
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, WKNavigationDelegate {
        let parent: OAuthWebView
        init(_ parent: OAuthWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.allow); return }

            let host = url.host ?? ""
            let allowedHosts = ["novossh.com", "github.com", "accounts.google.com"]
            let isAllowed = allowedHosts.contains(host) || host.hasSuffix(".novossh.com") || host.hasSuffix(".github.com") || host.hasSuffix(".google.com")

            if !isAllowed {
                parent.onError("Blocked navigation to \(host)")
                decisionHandler(.cancel)
                return
            }

            let urlString = url.absoluteString
            if let components = URLComponents(string: urlString),
               let items = components.queryItems {
                if let token = items.first(where: { $0.name == "oauth_token" })?.value,
                   let expiresStr = items.first(where: { $0.name == "oauth_expires" })?.value,
                   let expires = TimeInterval(expiresStr) {
                    parent.onTokenReceived(token, expires)
                    decisionHandler(.cancel)
                    return
                }
                if let error = items.first(where: { $0.name == "oauth_error" })?.value {
                    parent.onError(error)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let http = navigationResponse.response as? HTTPURLResponse, http.statusCode == 429 {
                parent.onError("Too many sign-in attempts. Please wait a moment and try again.")
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
#endif
