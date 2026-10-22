package com.contentsync.app.presentation.videos

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun VideoUploadScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    var selectedClientId by remember(uiState.clients) {
        mutableStateOf(uiState.clients.firstOrNull()?.id ?: "")
    }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var hashtags by remember { mutableStateOf("#marketing #reels #shorts") }
    var durationSecondsText by remember { mutableStateOf("45") }
    var sizeMbText by remember { mutableStateOf("28.5") }
    var dayOfWeek by remember { mutableIntStateOf(3) }
    var plannedTime by remember { mutableStateOf("2026-10-25 18:00") }

    var targetInstagram by remember { mutableStateOf(true) }
    var targetTikTok by remember { mutableStateOf(true) }
    var targetYouTube by remember { mutableStateOf(true) }

    // Ajustes específicos por plataforma
    var shareToFeed by remember { mutableStateOf(true) }
    var allowComments by remember { mutableStateOf(true) }
    var allowDuetStitch by remember { mutableStateOf(true) }
    var madeForKids by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Subida Unificada Multiplataforma (S3 URL Prefirmada)",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Sube el video una sola vez. Se valida duración, formato y peso según cada red seleccionada.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (uiState.uploadProgress > 0f) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Subiendo a S3 (Reanudable): ${(uiState.uploadProgress * 100).toInt()}%",
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { uiState.uploadProgress },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        Text("1. Seleccionar Cliente:", fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            uiState.clients.forEach { client ->
                FilterChip(
                    selected = selectedClientId == client.id,
                    onClick = { selectedClientId = client.id },
                    label = { Text(client.companyName) }
                )
            }
        }

        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("Título del video") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Descripción / Copy") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2
        )

        OutlinedTextField(
            value = hashtags,
            onValueChange = { hashtags = it },
            label = { Text("Hashtags (separados por espacio o coma)") },
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = durationSecondsText,
                onValueChange = { durationSecondsText = it },
                label = { Text("Duración (seg)") },
                supportingText = { Text("YouTube Shorts máx 180s") },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = sizeMbText,
                onValueChange = { sizeMbText = it },
                label = { Text("Peso (MB)") },
                supportingText = { Text("TikTok máx 500 MB") },
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = dayOfWeek.toString(),
                onValueChange = { dayOfWeek = it.toIntOrNull()?.coerceIn(1, 7) ?: 1 },
                label = { Text("Día semana (1=Lun..7=Dom)") },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = plannedTime,
                onValueChange = { plannedTime = it },
                label = { Text("Fecha/Hora en Cronograma") },
                modifier = Modifier.weight(1f)
            )
        }

        Text("2. Plataformas Destino:", fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = targetInstagram,
                onClick = { targetInstagram = !targetInstagram },
                label = { Text("Instagram Reels") }
            )
            FilterChip(
                selected = targetTikTok,
                onClick = { targetTikTok = !targetTikTok },
                label = { Text("TikTok") }
            )
            FilterChip(
                selected = targetYouTube,
                onClick = { targetYouTube = !targetYouTube },
                label = { Text("YouTube Shorts") }
            )
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("3. Ajustes Específicos por Plataforma:", fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = shareToFeed, onCheckedChange = { shareToFeed = it })
                    Text("Instagram Reels: Compartir también en el Feed principal")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = allowComments, onCheckedChange = { allowComments = it })
                    Text("Instagram / TikTok: Permitir comentarios")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = allowDuetStitch, onCheckedChange = { allowDuetStitch = it })
                    Text("TikTok: Permitir Dúo y Pegar (Duet / Stitch)")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = madeForKids, onCheckedChange = { madeForKids = it })
                    Text("YouTube Shorts: Contenido creado para niños (COPPA)")
                }
            }
        }

        Button(
            onClick = {
                val platforms = buildList {
                    if (targetInstagram) add(SocialPlatform.INSTAGRAM)
                    if (targetTikTok) add(SocialPlatform.TIKTOK)
                    if (targetYouTube) add(SocialPlatform.YOUTUBE)
                }
                viewModel.uploadVideoToSchedule(
                    clientId = selectedClientId,
                    scheduleId = uiState.schedules.firstOrNull()?.id ?: "sched-default",
                    title = title.ifBlank { "Nuevo Reel / Short" },
                    description = description.ifBlank { "Contenido semanal" },
                    hashtagsRaw = hashtags,
                    durationSeconds = durationSecondsText.toIntOrNull() ?: 45,
                    sizeMb = sizeMbText.toDoubleOrNull() ?: 25.0,
                    dayOfWeek = dayOfWeek,
                    plannedTime = plannedTime,
                    platforms = platforms,
                    shareToFeed = shareToFeed,
                    allowComments = allowComments,
                    allowDuetStitch = allowDuetStitch,
                    madeForKids = madeForKids
                )
                title = ""
                description = ""
            },
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            Icon(Icons.Default.CloudUpload, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Subir Video y Enviar a Revisión del Cliente")
        }
    }
}
