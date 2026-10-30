package com.contentsync.app.presentation.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.StudioSectionHeader
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.domain.model.ThemeModePreference
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun SettingsScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val session = uiState.session ?: return
    val palette = StudioTheme.colors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        StudioSectionHeader(
            eyebrow = "SISTEMA · SEGURIDAD CRIPTOGRÁFICA Y ENTORNO VISUAL",
            title = "Credencial y Calibración",
            subtitle = "Inspección de sesión activa, almacén seguro de tokens y calibración luminosa de sala."
        )

        // Pase de Operador Activo
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "TU PERFIL",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
            Text(
                text = session.fullName,
                style = MaterialTheme.typography.headlineMedium,
                color = palette.textPrimary
            )
            HorizontalDivider(thickness = 1.dp, color = palette.hairline)
            SpecRow("CORREO", session.email)
            SpecRow("ZONA HORARIA", session.timezone)
        }

        // Calibración Óptica de Superficie
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "APARIENCIA",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
            Text(
                text = "El tema oscuro descansa la vista; el claro se lee mejor a pleno sol.",
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    ThemeModePreference.DARK to "OSCURO",
                    ThemeModePreference.LIGHT to "CLARO",
                    ThemeModePreference.SYSTEM to "SISTEMA"
                ).forEach { (mode, label) ->
                    val active = uiState.themeMode == mode
                    Surface(
                        color = if (active) palette.signalSubtleBg else palette.canvas,
                        shape = RoundedCornerShape(3.dp),
                        border = BorderStroke(
                            1.dp,
                            if (active) palette.signalAccent else palette.borderStrong
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .clickable { viewModel.setThemeMode(mode) }
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (active) palette.signalSubtleText else palette.textSecondary,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Button(
            onClick = { viewModel.logout() },
            shape = RoundedCornerShape(3.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = palette.tallyFault,
                contentColor = Color.White
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp)
        ) {
            Text(
                text = "CERRAR SESIÓN",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SpecRow(label: String, value: String) {
    val palette = StudioTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = palette.textMuted
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelSmall,
            color = palette.textPrimary,
            fontWeight = FontWeight.SemiBold
        )
    }
}
