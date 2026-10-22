package com.contentsync.app.presentation.schedules

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.PlatformChip
import com.contentsync.app.core.designsystem.PublicationStatusRow
import com.contentsync.app.core.designsystem.WorkflowStatusBadge
import com.contentsync.app.domain.model.*
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

private val DAY_NAMES = mapOf(
    1 to "Lunes",
    2 to "Martes",
    3 to "Miércoles",
    4 to "Jueves",
    5 to "Viernes",
    6 to "Sábado",
    7 to "Domingo"
)

@Composable
fun SchedulesAndApprovalsScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val role = uiState.session?.role ?: return
    var showNewScheduleDialog by remember { mutableStateOf(false) }
    var scheduleTitle by remember { mutableStateOf("") }
    var scheduleNotes by remember { mutableStateOf("") }
    var selectedClientId by remember(uiState.clients) {
        mutableStateOf(uiState.clients.firstOrNull()?.id ?: "")
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (role == UserRole.CLIENTE) "Mis Cronogramas Semanales y Aprobaciones"
                        else "Cronogramas Semanales y Flujo de Aprobación",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Flujo: Borrador → En Revisión → Aprobado / Cambios Solicitados → Programado → Publicado",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (role != UserRole.CLIENTE) {
                    FilledTonalButton(onClick = { showNewScheduleDialog = !showNewScheduleDialog }) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Crear Semana")
                    }
                }
            }
        }

        if (showNewScheduleDialog && role != UserRole.CLIENTE) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Nuevo Cronograma Semanal", fontWeight = FontWeight.Bold)
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
                            value = scheduleTitle,
                            onValueChange = { scheduleTitle = it },
                            label = { Text("Título de la Semana") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = scheduleNotes,
                            onValueChange = { scheduleNotes = it },
                            label = { Text("Objetivos y notas de contenido") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            onClick = {
                                if (selectedClientId.isNotBlank() && scheduleTitle.isNotBlank()) {
                                    viewModel.createWeeklySchedule(
                                        selectedClientId,
                                        "2026-10-26",
                                        "2026-11-01",
                                        scheduleTitle,
                                        scheduleNotes
                                    )
                                    scheduleTitle = ""
                                    scheduleNotes = ""
                                    showNewScheduleDialog = false
                                }
                            }
                        ) {
                            Text("Publicar Cronograma para el Cliente")
                        }
                    }
                }
            }
        }

        if (uiState.videos.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "No hay videos en el cronograma",
                    subtitle = "Cuando la agencia suba videos para tu marca aparecerán aquí organizados por día."
                )
            }
        }

        items(uiState.videos, key = { it.id }) { video ->
            VideoApprovalAndPublishCard(
                video = video,
                userRole = role,
                viewModel = viewModel
            )
        }
    }
}

@Composable
private fun VideoApprovalAndPublishCard(
    video: VideoItem,
    userRole: UserRole,
    viewModel: MainViewModel
) {
    var feedbackNotes by remember { mutableStateOf("") }
    var scheduledDateInput by remember { mutableStateOf("") }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${DAY_NAMES[video.dayOfWeek] ?: "Día"} • ${video.plannedPublishAt} • ${video.clientName}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
                WorkflowStatusBadge(status = video.workflowStatus)
            }

            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = video.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = video.description,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "Duración: ${video.durationSeconds}s • Tamaño: ${video.sizeMb} MB • Hashtags: ${video.hashtags.joinToString(" ") { "#$it" }}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                video.targetPlatforms.forEach { PlatformChip(it) }
            }

            // Comentarios y notas de revisión
            if (video.comments.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Text(
                    "Notas y Comentarios de Revisión:",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                video.comments.forEach { c ->
                    Text(
                        text = "• ${c.authorName} (${c.createdAt}): ${c.message}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            // Estado individual por plataforma si ya fue programado o publicado
            if (video.publications.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Text(
                    "Estado Individual por Plataforma:",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                video.publications.forEach { pub ->
                    PublicationStatusRow(
                        platform = pub.platform,
                        status = pub.status,
                        errorMsg = pub.lastErrorMessage
                    )
                    if (pub.status == PublicationStatus.FAILED && userRole != UserRole.CLIENTE) {
                        TextButton(
                            onClick = { viewModel.retryFailedPlatform(video.id, pub.platform) }
                        ) {
                            Text("Reintentar en ${pub.platform.displayName}")
                        }
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

            // Panel de Aprobación del Cliente (APROBAR, PEDIR CAMBIOS, RECHAZAR + Notas)
            if (video.workflowStatus != VideoWorkflowStatus.PUBLISHED) {
                OutlinedTextField(
                    value = feedbackNotes,
                    onValueChange = { feedbackNotes = it },
                    label = { Text("Dejar nota o comentario para este video") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            viewModel.reviewVideo(video.id, ApprovalDecision.APPROVED, feedbackNotes)
                            feedbackNotes = ""
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Aprobar")
                    }
                    OutlinedButton(
                        onClick = {
                            viewModel.reviewVideo(video.id, ApprovalDecision.CHANGES_REQUESTED, feedbackNotes)
                            feedbackNotes = ""
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.EditNote, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Cambios")
                    }
                    OutlinedButton(
                        onClick = {
                            viewModel.reviewVideo(video.id, ApprovalDecision.REJECTED, feedbackNotes)
                            feedbackNotes = ""
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Rechazar")
                    }
                }
            }

            // Panel de Publicación Multiplataforma y Programación (Solo Agencia y Admin)
            if (userRole != UserRole.CLIENTE && video.workflowStatus != VideoWorkflowStatus.PUBLISHED) {
                Spacer(modifier = Modifier.height(10.dp))
                val isApproved = video.workflowStatus == VideoWorkflowStatus.APPROVED ||
                        video.workflowStatus == VideoWorkflowStatus.SCHEDULED

                OutlinedTextField(
                    value = scheduledDateInput,
                    onValueChange = { scheduledDateInput = it },
                    label = { Text("Programar fecha/hora (vacío = publicar ahora)") },
                    placeholder = { Text("Ej: 2026-10-25 18:30 (Zona horaria usuario)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(6.dp))
                Button(
                    onClick = {
                        viewModel.publishOrScheduleVideo(
                            videoId = video.id,
                            scheduledForIso = scheduledDateInput.takeIf { it.isNotBlank() }
                        )
                    },
                    enabled = isApproved,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (isApproved) "Publicar / Programar en las ${video.targetPlatforms.size} Plataformas"
                        else "Bloqueado: Requiere Aprobación del Cliente"
                    )
                }
            }
        }
    }
}
