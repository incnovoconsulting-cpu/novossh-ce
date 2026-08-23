package app.novossh.android.ui.screens

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OAuthWebView(
    url: String,
    onTokenReceived: (token: String, expiresIn: Long) -> Unit,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    var isLoading by remember { mutableStateOf(true) }
    var pageTitle by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pageTitle.ifEmpty { "Sign In" }, color = Slate100, fontSize = 14.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Slate400)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
            )
        },
        containerColor = Ink950,
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Neon)
                }
            }

            @SuppressLint("SetJavaScriptEnabled")
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.userAgentString = settings.userAgentString.replace(
                            "wv", ""
                        )
                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                isLoading = true
                                url?.let {
                                    val uri = Uri.parse(it)
                                    val token = uri.getQueryParameter("oauth_token")
                                    val expires = uri.getQueryParameter("oauth_expires")
                                    if (token != null) {
                                        onTokenReceived(token, expires?.toLongOrNull() ?: 3600L)
                                        return
                                    }
                                    val error = uri.getQueryParameter("oauth_error")
                                    if (error != null) {
                                        onError(error)
                                        return
                                    }
                                }
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                                pageTitle = view?.title ?: ""
                            }

                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?,
                            ): Boolean {
                                val loadUrl = request?.url?.toString() ?: return false
                                val uri = Uri.parse(loadUrl)
                                val host = uri.host ?: return false
                                val allowedHosts = listOf("novossh.com", "github.com", "accounts.google.com")
                                if (host !in allowedHosts && !host.endsWith(".novossh.com") && !host.endsWith(".github.com") && !host.endsWith(".google.com")) {
                                    onError(" blocked")
                                    return true
                                }
                                val token = uri.getQueryParameter("oauth_token")
                                val expires = uri.getQueryParameter("oauth_expires")
                                if (token != null) {
                                    onTokenReceived(token, expires?.toLongOrNull() ?: 3600L)
                                    return true
                                }
                                val error = uri.getQueryParameter("oauth_error")
                                if (error != null) {
                                    onError(error)
                                    return true
                                }
                                return false
                            }
                        }
                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
