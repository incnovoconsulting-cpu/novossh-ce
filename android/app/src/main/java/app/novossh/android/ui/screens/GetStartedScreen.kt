package app.novossh.android.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*
import app.novossh.android.viewmodel.AppViewModel
import kotlinx.coroutines.launch

data class OnboardingStep(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val title: String,
    val description: String,
)

private val steps = listOf(
    OnboardingStep(
        Icons.Default.Computer,
        "Add Your First Host",
        "Connect to any SSH server. Save hosts with labels, colors, and auth methods for quick access.",
    ),
    OnboardingStep(
        Icons.Default.Terminal,
        "Full Terminal",
        "A real terminal with xterm-256color support, bold/underline text, and ANSI colors. Just like your desktop.",
    ),
    OnboardingStep(
        Icons.Default.Lock,
        "Secure Vault",
        "Store credentials, SSH keys, and notes in encrypted vaults. Share with your team securely.",
    ),
    OnboardingStep(
        Icons.Default.Folder,
        "SFTP Browser",
        "Browse, upload, and download files from remote servers. Drag-and-drop simplicity.",
    ),
    OnboardingStep(
        Icons.Default.Code,
        "Command Snippets",
        "Save and reuse commands across hosts. Organize by package and search instantly.",
    ),
)

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun GetStartedScreen(
    viewModel: AppViewModel,
    onDismiss: () -> Unit,
) {
    val pagerState = rememberPagerState(pageCount = { steps.size })
    val scope = rememberCoroutineScope()

    Scaffold(
        containerColor = Ink950,
        topBar = {
            TopAppBar(
                title = { },
                actions = {
                    TextButton(onClick = onDismiss) {
                        Text("Skip", color = Slate500, fontSize = 13.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink950),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f),
            ) { page ->
                val step = steps[page]
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(Neon.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            step.icon,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = Neon,
                        )
                    }
                    Spacer(Modifier.height(32.dp))
                    Text(
                        step.title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = Slate100,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        step.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate400,
                        textAlign = TextAlign.Center,
                        lineHeight = 22.sp,
                    )
                }
            }

            // Page indicators
            Row(
                modifier = Modifier.padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                repeat(steps.size) { index ->
                    Box(
                        modifier = Modifier
                            .size(if (pagerState.currentPage == index) 24.dp else 8.dp, 8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (pagerState.currentPage == index) Neon else Ink600)
                    )
                }
            }

            // Action buttons
            Button(
                onClick = {
                    if (pagerState.currentPage < steps.size - 1) {
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    } else {
                        viewModel.completeOnboarding()
                        onDismiss()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Neon,
                    contentColor = Ink950,
                ),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    if (pagerState.currentPage < steps.size - 1) "Next" else "Get Started",
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}
