package app.novossh.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.novossh.android.ui.theme.*

@Composable
fun BroadcastInputBar(
    onSend: (String) -> Unit,
) {
    var text by remember { mutableStateOf("") }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Neon.copy(alpha = 0.06f))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "BROADCAST",
            color = Neon,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .background(Neon.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 3.dp),
        )

        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.weight(1f),
            placeholder = { Text("Send to all sessions…", color = Slate600, fontSize = 12.sp) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Slate100,
                unfocusedTextColor = Slate100,
                focusedBorderColor = Neon.copy(alpha = 0.4f),
                unfocusedBorderColor = Ink600,
                cursorColor = Neon,
            ),
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 12.sp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = {
                if (text.isNotEmpty()) { onSend(text); text = "" }
            }),
        )

        IconButton(
            onClick = { if (text.isNotEmpty()) { onSend(text); text = "" } },
            enabled = text.isNotEmpty(),
        ) {
            Icon(Icons.Default.Send, null,
                tint = if (text.isNotEmpty()) Neon else Slate600)
        }
    }
}
