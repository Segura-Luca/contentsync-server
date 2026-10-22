package com.contentsync.app.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.domain.model.ThemeModePreference
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun SettingsScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val session = uiState.session ?: return

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Perfil, Seguridad y Apariencia",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(session.fullName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Email: ${session.email}")
                Text("Rol RBAC: ${session.role.name}")
                Text("Zona Horaria: ${session.timezone}")
                Text("Tokens guardados en: Android Keystore (EncryptedSharedPreferences AES256-GCM)")
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Tema Material 3 (Claro / Oscuro / Sistema)", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemeModePreference.entries.forEach { mode ->
                        FilterChip(
                            selected = uiState.themeMode == mode,
                            onClick = { viewModel.setThemeMode(mode) },
                            label = {
                                Text(
                                    when (mode) {
                                        ThemeModePreference.SYSTEM -> "Seguir Sistema"
                                        ThemeModePreference.LIGHT -> "Modo Claro"
                                        ThemeModePreference.DARK -> "Modo Oscuro"
                                    }
                                )
                            }
                        )
                    }
                }
            }
        }

        Button(
            onClick = { viewModel.logout() },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Cerrar Sesión y Revocar Refresh Tokens")
        }
    }
}
