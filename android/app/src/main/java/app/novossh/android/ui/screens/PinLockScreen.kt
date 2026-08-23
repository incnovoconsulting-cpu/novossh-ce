package app.novossh.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*

@Composable
fun PinLockScreen(
    onUnlock: () -> Unit,
    validatePin: (String) -> Boolean,
) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(pin) {
        if (pin.length == 4) {
            if (validatePin(pin)) {
                onUnlock()
            } else {
                error = "Incorrect PIN"
                pin = ""
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink950)
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.height(80.dp))

        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = Neon,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text("Enter PIN", color = Slate100, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Enter your 4-digit PIN to unlock", color = Slate500, fontSize = 14.sp)

        Spacer(modifier = Modifier.height(32.dp))

        // PIN dots
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            repeat(4) { i ->
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(if (i < pin.length) Neon else Ink600)
                )
            }
        }

        if (error.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(error, color = Color(0xFFEF4444), fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.height(40.dp))

        // Number pad
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items((1..9).toList()) { num ->
                PinNumButton("$num") {
                    if (pin.length < 4) pin += "$num"
                }
            }
            item { Spacer(modifier = Modifier) }
            item {
                PinNumButton("0") {
                    if (pin.length < 4) pin += "0"
                }
            }
            item {
                PinNumButton("⌫") {
                    if (pin.isNotEmpty()) pin = pin.dropLast(1)
                }
            }
        }
    }
}

@Composable
private fun PinNumButton(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(Ink800)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = Slate100,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

