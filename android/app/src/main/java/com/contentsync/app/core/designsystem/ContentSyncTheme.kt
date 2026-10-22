package com.contentsync.app.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.domain.model.PublicationStatus
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.ThemeModePreference
import com.contentsync.app.domain.model.VideoWorkflowStatus

private val LightColors = lightColorScheme(
    primary = Color(0xFF4338CA),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    onPrimaryContainer = Color(0xFF1E1B4B),
    secondary = Color(0xFF0D9488),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCCFBF1),
    onSecondaryContainer = Color(0xFF134E4A),
    tertiary = Color(0xFFDB2777),
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    surfaceVariant = Color(0xFFF1F5F9),
    error = Color(0xFFDC2626)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF818CF8),
    onPrimary = Color(0xFF1E1B4B),
    primaryContainer = Color(0xFF312E81),
    onPrimaryContainer = Color(0xFFE0E7FF),
    secondary = Color(0xFF2DD4BF),
    onSecondary = Color(0xFF134E4A),
    secondaryContainer = Color(0xFF115E59),
    onSecondaryContainer = Color(0xFFCCFBF1),
    tertiary = Color(0xFFF472B6),
    background = Color(0xFF0F172A),
    surface = Color(0xFF1E293B),
    surfaceVariant = Color(0xFF334155),
    error = Color(0xFFF87171)
)

@Composable
fun ContentSyncTheme(
    themePreference: ThemeModePreference = ThemeModePreference.SYSTEM,
    content: @Composable () -> Unit
) {
    val useDark = when (themePreference) {
        ThemeModePreference.SYSTEM -> isSystemInDarkTheme()
        ThemeModePreference.LIGHT -> false
        ThemeModePreference.DARK -> true
    }

    MaterialTheme(
        colorScheme = if (useDark) DarkColors else LightColors,
        content = content
    )
}

@Composable
fun WorkflowStatusBadge(status: VideoWorkflowStatus) {
    val (bg, fg) = when (status) {
        VideoWorkflowStatus.DRAFT -> Color(0xFFE2E8F0) to Color(0xFF334155)
        VideoWorkflowStatus.IN_REVIEW -> Color(0xFFFEF3C7) to Color(0xFF92400E)
        VideoWorkflowStatus.CHANGES_REQUESTED -> Color(0xFFFFEDD5) to Color(0xFF9A3412)
        VideoWorkflowStatus.REJECTED -> Color(0xFFFEE2E2) to Color(0xFF991B1B)
        VideoWorkflowStatus.APPROVED -> Color(0xFFD1FAE5) to Color(0xFF065F46)
        VideoWorkflowStatus.SCHEDULED -> Color(0xFFDBEAFE) to Color(0xFF1E40AF)
        VideoWorkflowStatus.PUBLISHED -> Color(0xFFCCFBF1) to Color(0xFF115E59)
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(50),
        modifier = Modifier.semantics {
            contentDescription = "Estado del flujo: ${status.label}"
        }
    ) {
        Text(
            text = status.label,
            color = fg,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun PlatformChip(platform: SocialPlatform) {
    AssistChip(
        onClick = {},
        label = { Text(platform.displayName, style = MaterialTheme.typography.labelSmall) },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    )
}

@Composable
fun PublicationStatusRow(platform: SocialPlatform, status: PublicationStatus, errorMsg: String?) {
    val icon = when (status) {
        PublicationStatus.PUBLISHED -> Icons.Default.CheckCircle
        PublicationStatus.FAILED -> Icons.Default.ErrorOutline
        PublicationStatus.PROCESSING -> Icons.Default.Schedule
        PublicationStatus.PENDING -> Icons.Default.Info
    }
    val tint = when (status) {
        PublicationStatus.PUBLISHED -> Color(0xFF10B981)
        PublicationStatus.FAILED -> MaterialTheme.colorScheme.error
        PublicationStatus.PROCESSING -> Color(0xFFF59E0B)
        PublicationStatus.PENDING -> MaterialTheme.colorScheme.primary
    }

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = status.label,
                tint = tint,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "${platform.displayName}: ${status.label}",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium
            )
        }
        if (!errorMsg.isNullOrBlank()) {
            Text(
                text = errorMsg,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(start = 24.dp, top = 2.dp)
            )
        }
    }
}

@Composable
fun EmptyStateCard(title: String, subtitle: String) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Text(subtitle, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
