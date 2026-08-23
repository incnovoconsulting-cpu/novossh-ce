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
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AuthViewModel

@Composable
fun SignupScreen(
    authViewModel: AuthViewModel,
    onSignupSuccess: () -> Unit,
    onSwitchToLogin: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var confirmError by remember { mutableStateOf<String?>(null) }
    var oauthProvider by remember { mutableStateOf<String?>(null) }

    val focusManager = LocalFocusManager.current
    val passwordFocus = remember { FocusRequester() }
    val confirmFocus = remember { FocusRequester() }
    val API_BASE = "https://ssh.novossh.com:8787"

    if (oauthProvider != null) {
        val provider = oauthProvider!!
        OAuthWebView(
            url = "$API_BASE/api/auth/oauth/$provider",
            onTokenReceived = { token, expiresIn ->
                oauthProvider = null
                authViewModel.loginWithToken(token, expiresIn) { success, _ ->
                    if (success) onSignupSuccess()
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
        val brush = Brush.radialGradient(
            colors = listOf(NeonGlow, Color.Transparent),
            center = Offset(0.5f, 0.3f),
            radius = 800f,
        )
        Box(modifier = Modifier.fillMaxSize().background(brush))

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
                            "Create account",
                            style = MaterialTheme.typography.titleLarge,
                            color = Slate100,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = (-0.5).sp,
                        )
                        Text(
                            "7-day free trial of Starter",
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
                                    placeholder = { Text("at least 8 characters", color = Slate600, fontSize = 14.sp) },
                                    isError = passwordError != null,
                                    singleLine = true,
                                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Password,
                                        imeAction = ImeAction.Next,
                                    ),
                                    keyboardActions = KeyboardActions(onNext = { confirmFocus.requestFocus() }),
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

                            Column {
                                Text("Confirm password", color = Slate400, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = confirmPassword,
                                    onValueChange = {
                                        confirmPassword = it
                                        confirmError = null
                                        error = null
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .focusRequester(confirmFocus),
                                    placeholder = { Text("repeat password", color = Slate600, fontSize = 14.sp) },
                                    isError = confirmError != null,
                                    singleLine = true,
                                    visualTransformation = PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Password,
                                        imeAction = ImeAction.Done,
                                    ),
                                    keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = Neon,
                                        unfocusedBorderColor = Ink600,
                                        cursorColor = Neon,
                                        focusedTextColor = Slate100,
                                        unfocusedTextColor = Slate200,
                                    ),
                                    shape = RoundedCornerShape(10.dp),
                                )
                                if (confirmError != null) {
                                    Text(confirmError!!, color = TerminalRed, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                emailError = null
                                passwordError = null
                                confirmError = null
                                error = null

                                if (email.isBlank()) {
                                    emailError = "Email is required"
                                    return@Button
                                }
                                if (password.isEmpty()) {
                                    passwordError = "Password is required"
                                    return@Button
                                }
                                if (password.length < 8) {
                                    passwordError = "Password must be at least 8 characters"
                                    return@Button
                                }
                                if (confirmPassword != password) {
                                    confirmError = "Passwords do not match"
                                    return@Button
                                }

                                loading = true
                                focusManager.clearFocus()
                                authViewModel.signup(email, password) { success, errMsg ->
                                    loading = false
                                    if (success) {
                                        onSignupSuccess()
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
                                Text("creating account...", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            } else {
                                Text("Start Free Trial", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "7-day free trial · no card required",
                            color = Slate500,
                            fontSize = 11.sp,
                            textAlign = TextAlign.Center,
                        )

                        Spacer(modifier = Modifier.height(12.dp))

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
                            "already have an account? ",
                            color = Slate500,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                        )
                        TextButton(onClick = onSwitchToLogin) {
                            Text("sign in", color = Neon.copy(alpha = 0.7f), fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
