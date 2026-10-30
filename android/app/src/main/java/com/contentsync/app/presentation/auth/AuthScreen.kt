package com.contentsync.app.presentation.auth

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.TriSyncBrandMark
import com.contentsync.app.core.designsystem.TriSyncConduit
import com.contentsync.app.domain.model.SocialAuthProvider
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.domain.model.VideoWorkflowStatus
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun AuthScreen(
    viewModel: MainViewModel,
    uiState: ContentSyncUiState = ContentSyncUiState(),
    isWideScreen: Boolean = false
) {
    val palette = StudioTheme.colors
    var isRegisterMode by remember { mutableStateOf(false) }
    var isRecoverMode by remember { mutableStateOf(false) }
    var recoverStep by remember { mutableStateOf(1) }
    var recoveryCode by remember { mutableStateOf("") }
    var recoveryNewPass by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf(UserRole.AGENCIA) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val startGoogle: () -> Unit = {
        scope.launch {
            requestGoogleIdToken(context)
                .onSuccess { token -> viewModel.loginSocial(SocialAuthProvider.GOOGLE, token) }
                .onFailure { err ->
                    viewModel.reportAuthError(err.message ?: "No pudimos iniciar sesión con Google.")
                }
        }
    }

    if (isWideScreen) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(palette.canvas)
        ) {
            // Columna Izquierda: Manifiesto de Estudio & Pases Rápidos RBAC
            Column(
                modifier = Modifier
                    .weight(0.48f)
                    .fillMaxHeight()
                    .background(palette.stage)
                    .padding(32.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                StudioManifestoBlock()
                Spacer(modifier = Modifier.height(24.dp))
                QuickSeedPassesBlock(
                    onSelectAccount = { seedEmail, seedPass ->
                        email = seedEmail
                        password = seedPass
                        viewModel.login(seedEmail, seedPass)
                    }
                )
            }

            VerticalDivider(thickness = 1.dp, color = palette.hairline)

            // Columna Derecha: Consola de Autenticación Criptográfica
            Box(
                modifier = Modifier
                    .weight(0.52f)
                    .fillMaxHeight()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                if (isRecoverMode) {
                    AuthRecoveryConsole(
                        step = recoverStep,
                        email = email,
                        onEmailChange = { email = it },
                        recoveryCode = recoveryCode,
                        onRecoveryCodeChange = { recoveryCode = it },
                        newPassword = recoveryNewPass,
                        onNewPasswordChange = { recoveryNewPass = it },
                        isLoading = uiState.isLoading,
                        onRequestCode = {
                            viewModel.requestPasswordRecovery(email) {
                                recoveryCode = ""
                                recoverStep = 2
                            }
                        },
                        onSubmitReset = {
                            viewModel.submitPasswordReset(recoveryCode, recoveryNewPass) {
                                isRecoverMode = false
                                password = recoveryNewPass
                            }
                        },
                        onBackToLogin = {
                            isRecoverMode = false
                            recoverStep = 1
                        },
                        onResendCode = {
                            recoverStep = 1
                        }
                    )
                } else {
                    AuthFormConsole(
                        isRegisterMode = isRegisterMode,
                        onToggleRegister = { isRegisterMode = !isRegisterMode },
                        email = email,
                        onEmailChange = { email = it },
                        password = password,
                        onPasswordChange = { password = it },
                        fullName = fullName,
                        onFullNameChange = { fullName = it },
                        selectedRole = selectedRole,
                        onRoleChange = { selectedRole = it },
                        isLoading = uiState.isLoading,
                        onSubmit = {
                            if (isRegisterMode) viewModel.register(fullName, email, password, selectedRole)
                            else viewModel.login(email, password)
                        },
                        onRecover = {
                            isRecoverMode = true
                            recoverStep = 1
                        },
                        onGoogle = startGoogle
                    )
                }
            }
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(palette.canvas)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            StudioManifestoBlock()
            QuickSeedPassesBlock(
                onSelectAccount = { seedEmail, seedPass ->
                    email = seedEmail
                    password = seedPass
                    viewModel.login(seedEmail, seedPass)
                }
            )
            HorizontalDivider(thickness = 1.dp, color = palette.hairline)
            if (isRecoverMode) {
                AuthRecoveryConsole(
                    step = recoverStep,
                    email = email,
                    onEmailChange = { email = it },
                    recoveryCode = recoveryCode,
                    onRecoveryCodeChange = { recoveryCode = it },
                    newPassword = recoveryNewPass,
                    onNewPasswordChange = { recoveryNewPass = it },
                    isLoading = uiState.isLoading,
                    onRequestCode = {
                        viewModel.requestPasswordRecovery(email) {
                            recoveryCode = ""
                            recoverStep = 2
                        }
                    },
                    onSubmitReset = {
                        viewModel.submitPasswordReset(recoveryCode, recoveryNewPass) {
                            isRecoverMode = false
                            password = recoveryNewPass
                        }
                    },
                    onBackToLogin = {
                        isRecoverMode = false
                        recoverStep = 1
                    },
                    onResendCode = {
                        recoverStep = 1
                    }
                )
            } else {
                AuthFormConsole(
                    isRegisterMode = isRegisterMode,
                    onToggleRegister = { isRegisterMode = !isRegisterMode },
                    email = email,
                    onEmailChange = { email = it },
                    password = password,
                    onPasswordChange = { password = it },
                    fullName = fullName,
                    onFullNameChange = { fullName = it },
                    selectedRole = selectedRole,
                    onRoleChange = { selectedRole = it },
                    isLoading = uiState.isLoading,
                    onSubmit = {
                        if (isRegisterMode) viewModel.register(fullName, email, password, selectedRole)
                        else viewModel.login(email, password)
                    },
                    onRecover = {
                        isRecoverMode = true
                        recoverStep = 1
                    },
                    onGoogle = startGoogle
                )
            }
        }
    }
}

@Composable
private fun StudioManifestoBlock() {
    val palette = StudioTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            TriSyncBrandMark()
            Text(
                text = "CONTENTSYNC",
                style = MaterialTheme.typography.labelLarge,
                color = palette.textPrimary
            )
        }

        Text(
            text = "Subí tu video una vez.\nPublicá en tres redes.",
            style = MaterialTheme.typography.headlineLarge,
            color = palette.textPrimary
        )

        Text(
            text = "Organizá la semana, conseguí la aprobación de tu cliente y publicá en Instagram, TikTok y YouTube sin repetir el trabajo.",
            style = MaterialTheme.typography.bodyMedium,
            color = palette.textSecondary
        )

        StudioSignalRouterSchematic()
    }
}

@Composable
private fun StudioSignalRouterSchematic() {
    val palette = StudioTheme.colors
    val infinite = rememberInfiniteTransition(label = "routerSchematic")
    val pulse by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "routerPulse"
    )
    val traceColor = palette.borderStrong
    val signalColor = if (palette.isDark) palette.signalAccent else palette.tallyLive

    Row(
        modifier = Modifier
            .padding(top = 4.dp)
            .fillMaxWidth()
            .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
            .background(palette.inspector, RoundedCornerShape(3.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Column(
            modifier = Modifier
                .border(1.dp, palette.borderStrong, RoundedCornerShape(2.dp))
                .background(palette.stage, RoundedCornerShape(2.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Text(
                text = "TU VIDEO",
                style = MaterialTheme.typography.labelSmall,
                color = palette.signalSubtleText,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "se sube una vez",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
        }

        Canvas(
            modifier = Modifier
                .weight(1f)
                .height(38.dp)
        ) {
            val startY = size.height / 2f
            val targetsY = listOf(5f, size.height / 2f, size.height - 5f)
            val splitX = size.width * 0.28f

            drawLine(traceColor, Offset(0f, startY), Offset(splitX, startY), strokeWidth = 1.4f)
            targetsY.forEachIndexed { idx, ty ->
                drawLine(traceColor, Offset(splitX, startY), Offset(splitX, ty), strokeWidth = 1.2f)
                drawLine(traceColor, Offset(splitX, ty), Offset(size.width, ty), strokeWidth = 1.4f)

                val p = ((pulse - idx * 0.14f) + 1f) % 1f
                val px = if (p < 0.28f) {
                    size.width * p
                } else {
                    splitX + (size.width - splitX) * ((p - 0.28f) / 0.72f)
                }
                val py = if (p < 0.28f) startY else ty
                drawCircle(
                    color = signalColor.copy(alpha = 0.85f),
                    radius = 2.4f,
                    center = Offset(px, py)
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            listOf("INSTAGRAM", "TIKTOK", "YOUTUBE").forEach { ch ->
                Text(
                    text = ch,
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.tallyLive,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun QuickSeedPassesBlock(
    onSelectAccount: (email: String, password: String) -> Unit
) {
    val palette = StudioTheme.colors
    val passes = listOf(
        Triple("AGENCIA", "Nova Digital", "agencia.nova@contentsync.io"),
        Triple("CLIENTE", "Kafecito", "cliente.kafecito@contentsync.io"),
        Triple("ADMINISTRADOR", "Gobierno Central", "admin@contentsync.io")
    )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "CUENTAS DE DEMOSTRACIÓN",
            style = MaterialTheme.typography.labelSmall,
            color = palette.textMuted
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            passes.forEach { (roleTag, name, mail) ->
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .border(1.dp, palette.borderStrong, RoundedCornerShape(3.dp))
                        .background(palette.stage, RoundedCornerShape(3.dp))
                        .clickable { onSelectAccount(mail, "ContentSync2026!") }
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = roleTag,
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.signalSubtleText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = name,
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.textPrimary,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                    Text(
                        text = "Entrar →",
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthFormConsole(
    isRegisterMode: Boolean,
    onToggleRegister: () -> Unit,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    fullName: String,
    onFullNameChange: (String) -> Unit,
    selectedRole: UserRole,
    onRoleChange: (UserRole) -> Unit,
    isLoading: Boolean,
    onSubmit: () -> Unit,
    onRecover: () -> Unit,
    onGoogle: () -> Unit
) {
    val palette = StudioTheme.colors

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
            .background(palette.stage, RoundedCornerShape(4.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (isRegisterMode) "REGISTRAR MI AGENCIA" else "INICIAR SESIÓN",
                style = MaterialTheme.typography.labelLarge,
                color = palette.textPrimary,
                fontWeight = FontWeight.Bold
            )
        }

        if (isRegisterMode) {
            Text(
                text = "Creá tu espacio privado de Agencia para gestionar a tus clientes y sus cronogramas de publicación.",
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary
            )

            OutlinedTextField(
                value = fullName,
                onValueChange = onFullNameChange,
                label = { Text("Nombre y apellido del titular") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        }

        OutlinedTextField(
            value = email,
            onValueChange = onEmailChange,
            label = { Text("Correo electrónico") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        OutlinedTextField(
            value = password,
            onValueChange = onPasswordChange,
            label = { Text("Contraseña") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Button(
            onClick = onSubmit,
            enabled = !isLoading,
            shape = RoundedCornerShape(3.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = palette.signalAccent,
                contentColor = palette.onSignalAccent
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp)
        ) {
            Text(
                text = if (isRegisterMode) "CREAR MI AGENCIA" else "INGRESAR",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (isRegisterMode) "← Volver a inicio de sesión" else "Crear cuenta de Agencia",
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary,
                modifier = Modifier.clickable(onClick = onToggleRegister)
            )
            Text(
                text = "Olvidé mi contraseña",
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary,
                modifier = Modifier.clickable(onClick = onRecover)
            )
        }

        HorizontalDivider(thickness = 1.dp, color = palette.hairline)

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = palette.hairline)
            Text(
                text = "o continuá con",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
            HorizontalDivider(modifier = Modifier.weight(1f), thickness = 1.dp, color = palette.hairline)
        }

        Surface(
            color = palette.canvas,
            shape = RoundedCornerShape(3.dp),
            border = BorderStroke(1.dp, palette.borderStrong),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(enabled = !isLoading, onClick = onGoogle)
        ) {
            Box(
                modifier = Modifier.padding(vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Continuar con Google",
                    style = MaterialTheme.typography.labelLarge,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun AuthRecoveryConsole(
    step: Int,
    email: String,
    onEmailChange: (String) -> Unit,
    recoveryCode: String,
    onRecoveryCodeChange: (String) -> Unit,
    newPassword: String,
    onNewPasswordChange: (String) -> Unit,
    isLoading: Boolean,
    onRequestCode: () -> Unit,
    onSubmitReset: () -> Unit,
    onBackToLogin: () -> Unit,
    onResendCode: () -> Unit
) {
    val palette = StudioTheme.colors

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
            .background(palette.stage, RoundedCornerShape(4.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (step == 1) "RECUPERAR CONTRASEÑA" else "NUEVA CONTRASEÑA",
                style = MaterialTheme.typography.labelLarge,
                color = palette.textPrimary,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "PASO $step DE 2",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
        }

        if (step == 1) {
            Text(
                text = "Ingresá tu correo para recibir un código de recuperación y definir una nueva contraseña.",
                style = MaterialTheme.typography.bodyMedium,
                color = palette.textSecondary
            )

            OutlinedTextField(
                value = email,
                onValueChange = onEmailChange,
                label = { Text("Correo electrónico") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = onRequestCode,
                enabled = !isLoading,
                shape = RoundedCornerShape(3.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.signalAccent,
                    contentColor = palette.onSignalAccent
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp)
            ) {
                Text(
                    text = if (isLoading) "GENERANDO CÓDIGO…" else "ENVIAR CÓDIGO DE RECUPERACIÓN →",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "← Volver a inicio de sesión",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.clickable(onClick = onBackToLogin)
                )
            }
        } else {
            Text(
                text = "Te enviamos un código de verificación de 6 dígitos a tu correo ($email). Revisá tu bandeja de entrada e ingresalo a continuación.",
                style = MaterialTheme.typography.bodyMedium,
                color = palette.textSecondary
            )

            OutlinedTextField(
                value = recoveryCode,
                onValueChange = onRecoveryCodeChange,
                label = { Text("Código de recuperación (6 dígitos)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = newPassword,
                onValueChange = onNewPasswordChange,
                label = { Text("Nueva contraseña") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = onSubmitReset,
                enabled = !isLoading,
                shape = RoundedCornerShape(3.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.signalAccent,
                    contentColor = palette.onSignalAccent
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp)
            ) {
                Text(
                    text = if (isLoading) "ACTUALIZANDO…" else "RESTABLECER CONTRASEÑA",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "← Reenviar código",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.clickable(onClick = onResendCode)
                )
                Text(
                    text = "Cancelar",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.clickable(onClick = onBackToLogin)
                )
            }
        }
    }
}
