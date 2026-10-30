package com.contentsync.app.presentation.videos

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.StudioSectionHeader
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.VerticalReelFrame
import com.contentsync.app.core.designsystem.shortCode
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

private val DAY_LABELS = listOf(
    1 to "LUN",
    2 to "MAR",
    3 to "MIÉ",
    4 to "JUE",
    5 to "VIE",
    6 to "SÁB",
    7 to "DOM"
)

@Composable
fun VideoUploadScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val palette = StudioTheme.colors

    var selectedClientId by remember(uiState.clients) {
        mutableStateOf(uiState.clients.firstOrNull()?.id ?: "")
    }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var hashtags by remember { mutableStateOf("#reels #shorts #marca") }
    var durationSecondsText by remember { mutableStateOf("45") }
    var sizeMbText by remember { mutableStateOf("28.5") }
    var dayOfWeek by remember { mutableIntStateOf(3) }
    var plannedTime by remember { mutableStateOf("2026-10-28 18:00") }

    var targetInstagram by remember { mutableStateOf(true) }
    var targetTikTok by remember { mutableStateOf(true) }
    var targetYouTube by remember { mutableStateOf(true) }

    var shareToFeed by remember { mutableStateOf(true) }
    var allowComments by remember { mutableStateOf(true) }
    var allowDuetStitch by remember { mutableStateOf(true) }
    var madeForKids by remember { mutableStateOf(false) }

    val parsedDuration = durationSecondsText.toIntOrNull() ?: 0
    val parsedSizeMb = sizeMbText.toDoubleOrNull() ?: 0.0

    val activePlatforms = buildList {
        if (targetInstagram) add(SocialPlatform.INSTAGRAM)
        if (targetTikTok) add(SocialPlatform.TIKTOK)
        if (targetYouTube) add(SocialPlatform.YOUTUBE)
    }

    val hasAnyViolation = activePlatforms.any { p ->
        parsedDuration <= 0 || parsedSizeMb <= 0.0 ||
                parsedDuration > p.maxDurationSec || parsedSizeMb > p.maxSizeMb
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        StudioSectionHeader(
            eyebrow = "SUBIR VIDEO",
            title = "Subida Unificada 1 → 3",
            subtitle = "Revisamos al instante que tu video cumpla los límites de cada red."
        )

        if (uiState.clients.isEmpty()) {
            EmptyStateCard(
                title = "Sin cuentas de cliente activas",
                subtitle = "Registrá primero una marca en la pestaña Cuentas para subir videos y armar el plan semanal."
            )
            return@Column
        }

        // Estado de transferencia S3 en curso con interpolación óptica suave
        val animatedUploadProgress by animateFloatAsState(
            targetValue = uiState.uploadProgress.coerceIn(0f, 1f),
            animationSpec = tween(durationMillis = 280),
            label = "s3UploadProgress"
        )
        AnimatedVisibility(
            visible = uiState.uploadProgress > 0f,
            enter = expandVertically(animationSpec = tween(180)) + fadeIn(animationSpec = tween(180)),
            exit = shrinkVertically(animationSpec = tween(150)) + fadeOut(animationSpec = tween(120))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, palette.signalAccent, RoundedCornerShape(3.dp))
                    .background(palette.signalSubtleBg, RoundedCornerShape(3.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "SUBIENDO VIDEO",
                        style = MaterialTheme.typography.labelMedium,
                        color = palette.signalSubtleText,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${(animatedUploadProgress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelLarge,
                        color = palette.signalSubtleText
                    )
                }
                LinearProgressIndicator(
                    progress = { animatedUploadProgress },
                    modifier = Modifier.fillMaxWidth().height(4.dp),
                    color = palette.signalSubtleText,
                    trackColor = palette.hairline
                )
            }
        }

        // 1. Selector de Cuenta / Marca
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "PASO 1 · CLIENTE",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                uiState.clients.forEach { client ->
                    val selected = selectedClientId == client.id
                    Surface(
                        color = if (selected) palette.signalSubtleBg else palette.stage,
                        shape = RoundedCornerShape(3.dp),
                        border = BorderStroke(
                            1.dp,
                            if (selected) palette.signalSubtleText.copy(alpha = 0.7f) else palette.borderStrong
                        ),
                        modifier = Modifier.clickable { selectedClientId = client.id }
                    ) {
                        Text(
                            text = client.companyName.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = if (selected) palette.signalSubtleText else palette.textPrimary,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }
        }

        // 2. Previsualización de Corte 9:16 + Metadatos de Guion
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            VerticalReelFrame(
                title = title.ifBlank { "Mi video" },
                durationSeconds = parsedDuration.coerceAtLeast(1),
                width = 68.dp,
                showSafeGuides = true
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Título interno / Pieza") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Guion / Copy de publicación") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                OutlinedTextField(
                    value = hashtags,
                    onValueChange = { hashtags = it },
                    label = { Text("Hashtags") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        }

        // 3. Telemetría del Archivo Maestro & Día de Emisión
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "PASO 2 · DATOS DEL VIDEO Y DÍA",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = durationSecondsText,
                    onValueChange = { durationSecondsText = it },
                    label = { Text("Duración (seg)") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = sizeMbText,
                    onValueChange = { sizeMbText = it },
                    label = { Text("Tamaño (MB)") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            // Selector táctil de día de la semana (1..7)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                DAY_LABELS.forEach { (num, code) ->
                    val active = dayOfWeek == num
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .border(
                                1.dp,
                                if (active) palette.signalAccent else palette.hairline,
                                RoundedCornerShape(2.dp)
                            )
                            .background(
                                if (active) palette.signalSubtleBg else palette.canvas,
                                RoundedCornerShape(2.dp)
                            )
                            .clickable { dayOfWeek = num }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = code,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (active) palette.signalSubtleText else palette.textMuted,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            OutlinedTextField(
                value = plannedTime,
                onValueChange = { plannedTime = it },
                label = { Text("Ventana de emisión planificada") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        }

        // 4. MATRIZ DE COMPATIBILIDAD TRI-CANAL EN TIEMPO REAL
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "PASO 3 · REDES DE DESTINO (TOCÁ PARA ELEGIR)",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )

            listOf(
                Triple(SocialPlatform.INSTAGRAM, targetInstagram) { targetInstagram = !targetInstagram },
                Triple(SocialPlatform.TIKTOK, targetTikTok) { targetTikTok = !targetTikTok },
                Triple(SocialPlatform.YOUTUBE, targetYouTube) { targetYouTube = !targetYouTube }
            ).forEach { (platform, isSelected, toggle) ->
                val durOk = parsedDuration in 1..platform.maxDurationSec
                val sizeOk = parsedSizeMb > 0.0 && parsedSizeMb <= platform.maxSizeMb
                val specOk = durOk && sizeOk

                val statusText = when {
                    !isSelected -> "OMITIDO"
                    !durOk -> "EXCEDE ${platform.maxDurationSec}S"
                    !sizeOk -> "EXCEDE ${platform.maxSizeMb}MB"
                    else -> "SPECS OK"
                }

                val statusColor = when {
                    !isSelected -> palette.textMuted
                    specOk -> palette.tallyLive
                    else -> palette.tallyFault
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(
                            1.dp,
                            if (!isSelected) palette.hairline else statusColor.copy(alpha = 0.6f),
                            RoundedCornerShape(3.dp)
                        )
                        .background(palette.canvas, RoundedCornerShape(3.dp))
                        .clickable { toggle() }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "${platform.shortCode} · ${platform.displayName}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (isSelected) palette.textPrimary else palette.textMuted,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Hasta ${platform.maxDurationSec}s · ${platform.maxSizeMb} MB",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textMuted
                        )
                    }
                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // 5. Flags específicos de APIs
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                .background(palette.stage, RoundedCornerShape(4.dp))
                .padding(12.dp)
        ) {
            Text(
                text = "PASO 4 · OPCIONES POR RED",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
            )
            HorizontalDivider(thickness = 1.dp, color = palette.hairline)
            PlatformFlagRow("Instagram Reels · Publicar también en Feed principal", shareToFeed) { shareToFeed = it }
            PlatformFlagRow("Instagram / TikTok · Habilitar comentarios públicos", allowComments) { allowComments = it }
            PlatformFlagRow("TikTok · Permitir Dúo y Pegar (Duet / Stitch)", allowDuetStitch) { allowDuetStitch = it }
            PlatformFlagRow("YouTube Shorts · Audiencia infantil (Cumplimiento COPPA)", madeForKids) { madeForKids = it }
        }

        Button(
            onClick = {
                viewModel.uploadVideoToSchedule(
                    clientId = selectedClientId,
                    scheduleId = uiState.schedules.firstOrNull()?.id ?: "sched-default",
                    title = title.ifBlank { "Corte Vertical 9:16" },
                    description = description.ifBlank { "Entrega audiovisual de pauta semanal" },
                    hashtagsRaw = hashtags,
                    durationSeconds = parsedDuration.takeIf { it > 0 } ?: 45,
                    sizeMb = parsedSizeMb.takeIf { it > 0.0 } ?: 25.0,
                    dayOfWeek = dayOfWeek,
                    plannedTime = plannedTime,
                    platforms = activePlatforms,
                    shareToFeed = shareToFeed,
                    allowComments = allowComments,
                    allowDuetStitch = allowDuetStitch,
                    madeForKids = madeForKids
                )
                if (!hasAnyViolation && activePlatforms.isNotEmpty()) {
                    title = ""
                    description = ""
                }
            },
            enabled = activePlatforms.isNotEmpty() && !uiState.isLoading,
            shape = RoundedCornerShape(3.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (hasAnyViolation) palette.tallyFault else palette.signalAccent,
                contentColor = if (hasAnyViolation) androidx.compose.ui.graphics.Color.White else palette.onSignalAccent
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Text(
                text = if (hasAnyViolation) {
                    "CORREGIR LÍMITES TÉCNICOS ANTES DE SUBIR"
                } else {
                    "SUBIR Y ENVIAR A REVISIÓN DEL CLIENTE →"
                },
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun PlatformFlagRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    val palette = StudioTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = palette.textPrimary
        )
    }
}
