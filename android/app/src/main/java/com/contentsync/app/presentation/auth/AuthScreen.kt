package com.contentsync.app.presentation.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.contentsync.app.domain.model.SocialAuthProvider
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.presentation.MainViewModel

@Composable
fun AuthScreen(viewModel: MainViewModel) {
    var isRegisterMode by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("agencia.nova@contentsync.io") }
    var password by remember { mutableStateOf("ContentSync2026!") }
    var fullName by remember { mutableStateOf("Lucas Herrera") }
    var selectedRole by remember { mutableStateOf(UserRole.AGENCIA) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Sync,
            contentDescription = "Logo ContentSync",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(56.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "ContentSync",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold
        )
        Text(
            text = "Sube un video una vez y publícalo en Instagram Reels, TikTok y YouTube Shorts",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Selector rápido de cuentas de prueba por rol (Seeds)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    "Acceso Rápido por Rol (Datos de Prueba / Seeds):",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilledTonalButton(
                        onClick = {
                            email = "admin@contentsync.io"
                            password = "ContentSync2026!"
                            viewModel.login(email, password)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Admin", style = MaterialTheme.typography.labelMedium)
                    }
                    FilledTonalButton(
                        onClick = {
                            email = "agencia.nova@contentsync.io"
                            password = "ContentSync2026!"
                            viewModel.login(email, password)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Agencia", style = MaterialTheme.typography.labelMedium)
                    }
                    FilledTonalButton(
                        onClick = {
                            email = "cliente.kafecito@contentsync.io"
                            password = "ContentSync2026!"
                            viewModel.login(email, password)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cliente", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (isRegisterMode) {
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Nombre completo") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedRole == UserRole.AGENCIA,
                    onClick = { selectedRole = UserRole.AGENCIA },
                    label = { Text("Rol: Agencia") }
                )
                FilterChip(
                    selected = selectedRole == UserRole.CLIENTE,
                    onClick = { selectedRole = UserRole.CLIENTE },
                    label = { Text("Rol: Cliente") }
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Correo electrónico") },
            leadingIcon = { Icon(Icons.Default.MailOutline, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Contraseña fuerte (Argon2id)") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                if (isRegisterMode) {
                    viewModel.register(fullName, email, password, selectedRole)
                } else {
                    viewModel.login(email, password)
                }
            },
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Text(if (isRegisterMode) "Registrar Cuenta Segura" else "Iniciar Sesión con JWT")
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TextButton(onClick = { isRegisterMode = !isRegisterMode }) {
                Text(if (isRegisterMode) "¿Ya tienes cuenta? Inicia sesión" else "Crear cuenta nueva")
            }
            TextButton(onClick = { viewModel.recoverPassword(email) }) {
                Text("Recuperar clave")
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

        Text(
            text = "Inicio de Sesión Social (Vinculación por Email)",
            style = MaterialTheme.typography.labelLarge
        )
        Text(
            text = "Nota: Solo autentica tu cuenta en la app. La conexión OAuth de Instagram/TikTok/YouTube se gestiona por cliente.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = {
                    viewModel.loginSocial(SocialAuthProvider.GOOGLE, email, "Usuario Google")
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Google")
            }
            OutlinedButton(
                onClick = {
                    viewModel.loginSocial(SocialAuthProvider.FACEBOOK, email, "Usuario Facebook")
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Facebook")
            }
            OutlinedButton(
                onClick = {
                    viewModel.loginSocial(SocialAuthProvider.GITHUB, email, "Usuario GitHub")
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("GitHub")
            }
        }
    }
}
