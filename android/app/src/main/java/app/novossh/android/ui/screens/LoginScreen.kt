package app.novossh.android.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import app.novossh.android.BuildConfig
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AuthViewModel

@Composable
fun LoginScreen(
    authViewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onSwitchToSignup: () -> Unit,
    onOpenDebug: () -> Unit = {},
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var oauthProvider by remember { mutableStateOf<String?>(null) }
    var showForgot by remember { mutableStateOf(false) }
    var forgotEmail by remember { mutableStateOf("") }
    var forgotSent by remember { mutableStateOf(false) }
    var forgotLoading by remember { mutableStateOf(false) }

    val focusManager = LocalFocusManager.current
    val passwordFocus = remember { FocusRequester() }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val API_BASE = "https://ssh.novossh.com:8787"

    if (oauthProvider != null) {
        val provider = oauthProvider!!
        OAuthWebView(
            url = "$API_BASE/api/auth/oauth/$provider",
            onTokenReceived = { token, expiresIn ->
                oauthProvider = null
                authViewModel.loginWithToken(token, expiresIn) { success, _ ->
                    if (success) onLoginSuccess()
                }
            },
            onError = { err -> oauthProvider = null; error = "OAuth failed: $err" },
            onBack = { oauthProvider = null },
        )
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink950)
    ) {
        NeonGridBackground()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Ink800.copy(alpha = 0.8f)),
                border = CardDefaults.outlinedCardBorder().takeIf { false },
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Spacer(modifier = Modifier.height(8.dp))

                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(Ink900, RoundedCornerShape(10.dp))
                                .border(1.dp, Neon.copy(alpha = 0.2f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Default.Terminal,
                                contentDescription = null,
                                tint = Neon,
                                modifier = Modifier.size(22.dp),
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            "NovoSSH",
                            style = MaterialTheme.typography.titleLarge,
                            color = Slate100,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = (-0.5).sp,
                        )
                        Text(
                            "secure terminal client",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        AnimatedVisibility(visible = error != null, enter = fadeIn(), exit = fadeOut()) {
                            error?.let {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(TerminalRed.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                                        .border(1.dp, TerminalRed.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text("!", color = TerminalRed, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(it, color = TerminalRed.copy(alpha = 0.8f), fontSize = 12.sp)
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Column {
                                Text("Email", color = Slate400, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = {
                                        email = it
                                        emailError = null
                                        error = null
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    placeholder = { Text("you@example.com", color = Slate600, fontSize = 14.sp) },
                                    isError = emailError != null,
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Email,
                                        imeAction = ImeAction.Next,
                                    ),
                                    keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = Neon,
                                        unfocusedBorderColor = Ink600,
                                        cursorColor = Neon,
                                        focusedTextColor = Slate100,
                                        unfocusedTextColor = Slate200,
                                    ),
                                    shape = RoundedCornerShape(10.dp),
                                )
                                if (emailError != null) {
                                    Text(emailError!!, color = TerminalRed, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
                                }
                            }

                            Column {
                                Text("Password", color = Slate400, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = password,
                                    onValueChange = {
                                        password = it
                                        passwordError = null
                                        error = null
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .focusRequester(passwordFocus),
                                    placeholder = { Text("your password", color = Slate600, fontSize = 14.sp) },
                                    isError = passwordError != null,
                                    singleLine = true,
                                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Password,
                                        imeAction = ImeAction.Done,
                                    ),
                                    keyboardActions = KeyboardActions(onDone = {
                                        focusManager.clearFocus()
                                    }),
                                    trailingIcon = {
                                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                            Icon(
                                                if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                                contentDescription = null,
                                                tint = Slate500,
                                                modifier = Modifier.size(18.dp),
                                            )
                                        }
                                    },
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = Neon,
                                        unfocusedBorderColor = Ink600,
                                        cursorColor = Neon,
                                        focusedTextColor = Slate100,
                                        unfocusedTextColor = Slate200,
                                    ),
                                    shape = RoundedCornerShape(10.dp),
                                )
                                if (passwordError != null) {
                                    Text(passwordError!!, color = TerminalRed, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                emailError = null
                                passwordError = null
                                error = null

                                var valid = true
                                if (email.isBlank()) {
                                    emailError = "Email is required"
                                    valid = false
                                }
                                if (password.isEmpty()) {
                                    passwordError = "Password is required"
                                    valid = false
                                }
                                if (!valid) return@Button

                                loading = true
                                focusManager.clearFocus()
                                authViewModel.login(email, password) { success, errMsg ->
                                    loading = false
                                    if (success) {
                                        onLoginSuccess()
                                    } else {
                                        error = errMsg
                                    }
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            enabled = !loading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Neon,
                                contentColor = Ink950,
                                disabledContainerColor = Neon.copy(alpha = 0.5f),
                            ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            if (loading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = Ink950,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("authenticating...", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            } else {
                                Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        TextButton(
                            onClick = { showForgot = true },
                            modifier = Modifier.align(Alignment.End),
                        ) {
                            Text("Forgot password?", color = Neon.copy(alpha = 0.7f), fontSize = 11.sp)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            HorizontalDivider(modifier = Modifier.weight(1f), color = Ink600)
                            Text("or", color = Slate500, fontSize = 11.sp)
                            HorizontalDivider(modifier = Modifier.weight(1f), color = Ink600)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedButton(
                                onClick = { oauthProvider = "github" },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300),
                                border = ButtonDefaults.outlinedButtonBorder,
                                shape = RoundedCornerShape(10.dp),
                                enabled = !loading,
                            ) {
                                Text("GitHub", fontSize = 12.sp)
                            }
                            OutlinedButton(
                                onClick = { oauthProvider = "google" },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate300),
                                border = ButtonDefaults.outlinedButtonBorder,
                                shape = RoundedCornerShape(10.dp),
                                enabled = !loading,
                            ) {
                                Text("Google", fontSize = 12.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            "no account? ",
                            color = Slate500,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                        )
                        TextButton(onClick = onSwitchToSignup) {
                            Text("create one", color = Neon.copy(alpha = 0.7f), fontSize = 12.sp)
                        }

                        TextButton(onClick = {
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@novossh.com"))
                            context.startActivity(intent)
                        }) {
                            Text("Contact Support", color = Slate500, fontSize = 11.sp)
                        }

                        if (BuildConfig.DEBUG) {
                            Spacer(modifier = Modifier.height(8.dp))
                            TextButton(onClick = onOpenDebug) {
                                Text("debug log", color = Slate600, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showForgot) {
        AlertDialog(
            onDismissRequest = { showForgot = false; forgotSent = false; forgotEmail = "" },
            containerColor = Ink800,
            title = { Text("Reset Password", color = Slate100, fontWeight = FontWeight.SemiBold) },
            text = {
                if (forgotSent) {
                    Text(
                        "If an account exists for $forgotEmail, a reset link has been sent. Check your spam folder too.",
                        color = Slate300,
                        fontSize = 13.sp,
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Enter your email and we'll send a reset link.", color = Slate400, fontSize = 12.sp)
                        OutlinedTextField(
                            value = forgotEmail,
                            onValueChange = { forgotEmail = it },
                            placeholder = { Text("you@example.com", color = Slate600, fontSize = 14.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Neon,
                                unfocusedBorderColor = Ink600,
                                cursorColor = Neon,
                                focusedTextColor = Slate100,
                                unfocusedTextColor = Slate200,
                            ),
                            shape = RoundedCornerShape(10.dp),
                        )
                    }
                }
            },
            confirmButton = {
                if (forgotSent) {
                    TextButton(onClick = { showForgot = false; forgotSent = false; forgotEmail = "" }) {
                        Text("Done", color = Neon)
                    }
                } else {
                    TextButton(
                        onClick = {
                            if (forgotEmail.isBlank()) return@TextButton
                            forgotLoading = true
                            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                                try {
                                    val conn = URL("$API_BASE/api/auth/forgot-password").openConnection() as HttpURLConnection
                                    conn.requestMethod = "POST"
                                    conn.setRequestProperty("Content-Type", "application/json")
                                    conn.doOutput = true
                                    conn.outputStream.write(JSONObject(mapOf("email" to forgotEmail)).toString().toByteArray())
                                    conn.responseCode // trigger request
                                    conn.disconnect()
                                } catch (_: Exception) {}
                                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                    forgotLoading = false
                                    forgotSent = true
                                }
                            }
                        },
                        enabled = !forgotLoading && forgotEmail.isNotBlank(),
                    ) {
                        if (forgotLoading) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Neon, strokeWidth = 2.dp)
                        else Text("Send Reset Link", color = Neon)
                    }
                }
            },
            dismissButton = {
                if (!forgotSent) {
                    TextButton(onClick = { showForgot = false; forgotEmail = "" }) {
                        Text("Cancel", color = Slate500)
                    }
                }
            },
        )
    }
}

@Composable
private fun NeonGridBackground() {
    val brush = Brush.radialGradient(
        colors = listOf(NeonGlow, Color.Transparent),
        center = Offset(0.5f, 0.3f),
        radius = 800f,
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush)
    )
}
