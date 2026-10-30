package com.contentsync.app.presentation.schedules

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.InteractiveTimelineScrubber
import com.contentsync.app.core.designsystem.PublicationStatusRow
import com.contentsync.app.core.designsystem.StudioSectionHeader
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.TriSyncConduit
import com.contentsync.app.core.designsystem.VerticalReelFrame
import com.contentsync.app.core.designsystem.WorkflowStatusBadge
import com.contentsync.app.domain.model.ApprovalDecision
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.domain.model.VideoItem
import com.contentsync.app.domain.model.VideoWorkflowStatus
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

private val DAY_CODES = mapOf(
    1 to "LUN",
    2 to "MAR",
    3 to "MIÉ",
    4 to "JUE",
    5 to "VIE",
    6 to "SÁB",
    7 to "DOM"
)

private val DAY_FULL = mapOf(
    1 to "Lunes",
    2 to "Martes",
    3 to "Miércoles",
    4 to "Jueves",
    5 to "Viernes",
    6 to "Sábado",
    7 to "Domingo"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulesAndApprovalsScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel,
    isWideScreen: Boolean = false,
    onNavigateToUpload: (() -> Unit)? = null
) {
    val role = uiState.session?.role ?: return
    val palette = StudioTheme.colors

    var clientFilterId by remember { mutableStateOf<String?>(null) }
    var showNewScheduleDrawer by remember { mutableStateOf(false) }
    var scheduleTitle by remember { mutableStateOf("") }
    var scheduleNotes by remember { mutableStateOf("") }
    var newScheduleClientId by remember(uiState.clients) {
        mutableStateOf(uiState.clients.firstOrNull()?.id ?: "")
    }

    val visibleVideos = remember(uiState.videos, clientFilterId) {
        uiState.videos
            .filter { clientFilterId == null || it.clientId == clientFilterId }
            .sortedWith(compareBy<VideoItem> { it.dayOfWeek }.thenBy { it.plannedPublishAt })
    }

    var selectedVideoId by remember(visibleVideos) {
        mutableStateOf(visibleVideos.firstOrNull()?.id)
    }
    var showMobileReviewSheet by remember { mutableStateOf(false) }

    val selectedVideo = visibleVideos.find { it.id == selectedVideoId } ?: visibleVideos.firstOrNull()

    val pendingReviewCount = visibleVideos.count {
        it.workflowStatus == VideoWorkflowStatus.IN_REVIEW ||
                it.workflowStatus == VideoWorkflowStatus.CHANGES_REQUESTED
    }
    val readyOrLiveCount = visibleVideos.count {
        it.workflowStatus == VideoWorkflowStatus.APPROVED ||
                it.workflowStatus == VideoWorkflowStatus.SCHEDULED ||
                it.workflowStatus == VideoWorkflowStatus.PUBLISHED
    }

    Row(modifier = Modifier.fillMaxSize()) {
        // COLUMNA PRINCIPAL: MATRIZ SEMANAL DE ALTA PRECISIÓN (1dp hairlines, cero formularios repetidos)
        LazyColumn(
            modifier = Modifier
                .weight(if (isWideScreen && visibleVideos.isNotEmpty()) 0.58f else 1f)
                .fillMaxHeight()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                StudioSectionHeader(
                    eyebrow = if (role == UserRole.CLIENTE) "VISADO DE MARCA · PAUTA SEMANAL"
                    else "TRÁFICO AUDIOVISUAL · PAUTA Y APROBACIONES",
                    title = if (role == UserRole.CLIENTE) "Entregas de la Semana" else "Pauta Semanal Multi-Red",
                    subtitle = "Tocá cualquier pieza 9:16 para abrir la Sala de Revisión, dejar notas o autorizar su emisión.",
                    trailing = if (role != UserRole.CLIENTE) {
                        {
                            Surface(
                                color = if (showNewScheduleDrawer) palette.elevated else palette.signalAccent,
                                shape = RoundedCornerShape(3.dp),
                                border = BorderStroke(1.dp, palette.borderStrong),
                                modifier = Modifier.clickable { showNewScheduleDrawer = !showNewScheduleDrawer }
                            ) {
                                Text(
                                    text = if (showNewScheduleDrawer) "CERRAR" else "+ NUEVA SEMANA",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (showNewScheduleDrawer) palette.textPrimary else palette.onSignalAccent,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }
                        }
                    } else null
                )
            }

            // Franja de estado real derivada de las entregas cargadas (cero métricas inventadas)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
                        .background(palette.stage, RoundedCornerShape(3.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TelemetryStatItem(label = "EN PAUTA", value = "${visibleVideos.size}")
                    TelemetryStatItem(label = "POR VISAR", value = "$pendingReviewCount")
                    TelemetryStatItem(label = "APROBADAS", value = "$readyOrLiveCount")
                }
            }

            // Selector de cuenta / cliente (cuando hay más de un cliente visible)
            if (uiState.clients.size > 1) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterTabButton(
                            label = "TODAS LAS CUENTAS",
                            selected = clientFilterId == null,
                            onClick = { clientFilterId = null }
                        )
                        uiState.clients.forEach { client ->
                            FilterTabButton(
                                label = client.companyName.uppercase(),
                                selected = clientFilterId == client.id,
                                onClick = {
                                    clientFilterId = if (clientFilterId == client.id) null else client.id
                                }
                            )
                        }
                    }
                }
            }

            // Cajón arquitectónico para abrir nueva pauta semanal
            if (showNewScheduleDrawer && role != UserRole.CLIENTE) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, palette.borderStrong, RoundedCornerShape(4.dp))
                            .background(palette.stage, RoundedCornerShape(4.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "NUEVO PLAN SEMANAL",
                            style = MaterialTheme.typography.labelLarge,
                            color = palette.textPrimary
                        )
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            uiState.clients.forEach { client ->
                                FilterTabButton(
                                    label = client.companyName,
                                    selected = newScheduleClientId == client.id,
                                    onClick = { newScheduleClientId = client.id }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = scheduleTitle,
                            onValueChange = { scheduleTitle = it },
                            label = { Text("Título de pauta (ej. Semana 45 · Lanzamiento)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = scheduleNotes,
                            onValueChange = { scheduleNotes = it },
                            label = { Text("Directriz creativa para el cliente") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            onClick = {
                                if (newScheduleClientId.isNotBlank() && scheduleTitle.isNotBlank()) {
                                    viewModel.createWeeklySchedule(
                                        newScheduleClientId,
                                        "2026-10-26",
                                        "2026-11-01",
                                        scheduleTitle,
                                        scheduleNotes
                                    )
                                    scheduleTitle = ""
                                    scheduleNotes = ""
                                    showNewScheduleDrawer = false
                                }
                            },
                            shape = RoundedCornerShape(3.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.signalAccent,
                                contentColor = palette.onSignalAccent
                            )
                        ) {
                            Text("PUBLICAR PAUTA Y NOTIFICAR CLIENTE", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            if (visibleVideos.isEmpty()) {
                item {
                    EmptyStateCard(
                        title = "Pauta semanal sin entregas",
                        subtitle = if (role == UserRole.CLIENTE) {
                            "Tu agencia aún no cargó piezas verticales para esta semana. Recibirás una alerta push apenas entren a revisión."
                        } else {
                            "Aún no hay videos asignados. Subí un video vertical 9:16 y lo preparamos para Reels, TikTok y Shorts."
                        },
                        actionLabel = if (role != UserRole.CLIENTE && onNavigateToUpload != null) "Subir video" else null,
                        onAction = onNavigateToUpload
                    )
                }
            } else {
                // Matriz continua con bordes de 1dp e índice de día editorial
                val groupedByDay = visibleVideos.groupBy { it.dayOfWeek }
                groupedByDay.forEach { (dayNum, dayVideos) ->
                    item(key = "day-header-$dayNum") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 6.dp, bottom = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = DAY_CODES[dayNum] ?: "DÍA",
                                style = MaterialTheme.typography.labelLarge,
                                color = palette.signalSubtleText,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = DAY_FULL[dayNum] ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.textMuted
                            )
                            HorizontalDivider(
                                modifier = Modifier.weight(1f),
                                thickness = 1.dp,
                                color = palette.hairline
                            )
                        }
                    }

                    items(dayVideos, key = { it.id }) { video ->
                        StudioScheduleRow(
                            video = video,
                            isSelected = isWideScreen && selectedVideo?.id == video.id,
                            onClick = {
                                selectedVideoId = video.id
                                if (!isWideScreen) {
                                    showMobileReviewSheet = true
                                }
                            }
                        )
                    }
                }
            }
        }

        // COLUMNA DERECHA (SOLO PANTALLA ANCHA / TABLET): SALA DE REVISIÓN CONTEXTUAL
        if (isWideScreen && selectedVideo != null) {
            VerticalDivider(thickness = 1.dp, color = palette.hairline)
            Box(
                modifier = Modifier
                    .weight(0.42f)
                    .fillMaxHeight()
                    .background(palette.inspector)
            ) {
                AnimatedContent(
                    targetState = selectedVideo,
                    contentKey = { it.id },
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(180)) +
                            slideInVertically(animationSpec = tween(200)) { fullHeight -> fullHeight / 30 })
                            .togetherWith(fadeOut(animationSpec = tween(110)))
                    },
                    label = "inspectorVideoCrossfade"
                ) { targetVideo ->
                    ReviewAndPublishInspector(
                        video = targetVideo,
                        userRole = role,
                        viewModel = viewModel
                    )
                }
            }
        }
    }

    // BOTTOM SHEET ENFOCADO (MÓVIL): SALA DE REVISIÓN SIN CONTAMINAR LA LISTA
    if (!isWideScreen && showMobileReviewSheet && selectedVideo != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showMobileReviewSheet = false },
            sheetState = sheetState,
            containerColor = palette.inspector,
            shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)
        ) {
            ReviewAndPublishInspector(
                video = selectedVideo,
                userRole = role,
                viewModel = viewModel
            )
        }
    }
}

@Composable
private fun TelemetryStatItem(label: String, value: String) {
    val palette = StudioTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = palette.textPrimary,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = palette.textMuted
        )
    }
}

@Composable
private fun FilterTabButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val palette = StudioTheme.colors
    Surface(
        color = if (selected) palette.signalSubtleBg else palette.stage,
        shape = RoundedCornerShape(2.dp),
        border = BorderStroke(
            1.dp,
            if (selected) palette.signalSubtleText.copy(alpha = 0.6f) else palette.hairline
        ),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) palette.signalSubtleText else palette.textSecondary,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun StudioScheduleRow(
    video: VideoItem,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val palette = StudioTheme.colors
    val rowBg by animateColorAsState(
        targetValue = if (isSelected) palette.inspector else palette.stage,
        animationSpec = tween(180),
        label = "rowBg"
    )
    val rowBorder by animateColorAsState(
        targetValue = if (isSelected) palette.borderStrong else palette.hairline,
        animationSpec = tween(180),
        label = "rowBorder"
    )
    val barHeight by animateDpAsState(
        targetValue = if (isSelected) 96.dp else 0.dp,
        animationSpec = tween(200),
        label = "rowBarHeight"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = rowBorder,
                shape = RoundedCornerShape(3.dp)
            )
            .background(
                color = rowBg,
                shape = RoundedCornerShape(3.dp)
            )
            .clickable(onClick = onClick)
            .padding(end = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Riel óptico de selección a la izquierda con deslizamiento calibrado
        Box(
            modifier = Modifier
                .width(3.dp)
                .height(96.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(barHeight)
                    .background(palette.signalAccent)
            )
        }

        Spacer(modifier = Modifier.width(10.dp))

        // Miniatura 9:16 real con código de tiempo MM:SS
        VerticalReelFrame(
            title = video.title,
            durationSeconds = video.durationSeconds,
            width = 48.dp,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Jerarquía limpia de 3 niveles
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = "${video.plannedPublishAt} · ${video.clientName} · ${video.sizeMb} MB",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = video.title,
                style = MaterialTheme.typography.titleMedium,
                color = palette.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = video.description,
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(3.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                WorkflowStatusBadge(status = video.workflowStatus)
                TriSyncConduit(
                    targetPlatforms = video.targetPlatforms,
                    publications = video.publications,
                    workflowStatus = video.workflowStatus
                )
            }
        }
    }
}

@Composable
private fun ReviewAndPublishInspector(
    video: VideoItem,
    userRole: UserRole,
    viewModel: MainViewModel
) {
    val palette = StudioTheme.colors
    var feedbackNotes by remember(video.id) { mutableStateOf("") }
    var scheduledDateInput by remember(video.id) { mutableStateOf("") }
    var scrubProgress by remember(video.id) { mutableFloatStateOf(0.28f) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Cabecera de Sala de Revisión
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "REVISIÓN",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                Text(
                    text = "${DAY_CODES[video.dayOfWeek] ?: "DÍA"} · ${video.plannedPublishAt}",
                    style = MaterialTheme.typography.labelLarge,
                    color = palette.signalSubtleText
                )
            }
            WorkflowStatusBadge(status = video.workflowStatus)
        }

        HorizontalDivider(thickness = 1.dp, color = palette.hairline)

        // Encuadre 9:16 con guías de tercios, playhead óptico en vivo + Copy literario
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            VerticalReelFrame(
                title = video.title,
                durationSeconds = video.durationSeconds,
                width = 84.dp,
                showSafeGuides = true,
                playheadProgress = scrubProgress
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = video.clientName.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                Text(
                    text = video.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = palette.textPrimary
                )
                Text(
                    text = video.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary
                )
                Text(
                    text = "${video.durationSeconds}s · ${video.sizeMb} MB · ${video.hashtags.joinToString(" ") { "#$it" }}",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
            }
        }

        // Scrubber óptico táctil para citar códigos de tiempo exactos sin invadir la vista
        InteractiveTimelineScrubber(
            durationSeconds = video.durationSeconds,
            progress = scrubProgress,
            onProgressChange = { scrubProgress = it },
            onStampTimecode = if (video.workflowStatus != VideoWorkflowStatus.PUBLISHED) {
                { tc ->
                    val prefix = "@$tc — "
                    feedbackNotes = if (feedbackNotes.isBlank()) prefix else "$feedbackNotes $prefix"
                }
            } else null
        )

        // Riel Tri-Canal Expandido y Estado Individual de APIs
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
                .background(palette.stage, RoundedCornerShape(3.dp))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SE PUBLICARÁ EN",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                TriSyncConduit(
                    targetPlatforms = video.targetPlatforms,
                    publications = video.publications,
                    workflowStatus = video.workflowStatus
                )
            }

            if (video.publications.isNotEmpty()) {
                video.publications.forEach { pub ->
                    PublicationStatusRow(
                        platform = pub.platform,
                        status = pub.status,
                        errorMsg = pub.lastErrorMessage,
                        onRetry = if (userRole != UserRole.CLIENTE) {
                            { viewModel.retryFailedPlatform(video.id, pub.platform) }
                        } else null
                    )
                }
            }
        }

        // Bitácora de comentarios de revisión
        if (video.comments.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
                    .background(palette.stage, RoundedCornerShape(3.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "COMENTARIOS",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                video.comments.forEach { comment ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, palette.hairline, RoundedCornerShape(2.dp))
                            .padding(8.dp)
                    ) {
                        Text(
                            text = "${comment.authorName} · ${comment.createdAt}",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.signalSubtleText
                        )
                        Text(
                            text = comment.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textPrimary
                        )
                    }
                }
            }
        }

        // Controles de Decisión del Cliente / Revisión
        if (video.workflowStatus != VideoWorkflowStatus.PUBLISHED) {
            OutlinedTextField(
                value = feedbackNotes,
                onValueChange = { feedbackNotes = it },
                label = { Text("Nota de corte o tiempo (ej. ajustar audio en 00:04)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        viewModel.reviewVideo(video.id, ApprovalDecision.APPROVED, feedbackNotes)
                        feedbackNotes = ""
                    },
                    shape = RoundedCornerShape(3.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.signalAccent,
                        contentColor = palette.onSignalAccent
                    ),
                    modifier = Modifier.weight(1.2f)
                ) {
                    Text("APROBAR ✓", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                }

                Surface(
                    color = palette.stage,
                    shape = RoundedCornerShape(3.dp),
                    border = BorderStroke(1.dp, palette.tallyWarn),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            viewModel.reviewVideo(video.id, ApprovalDecision.CHANGES_REQUESTED, feedbackNotes)
                            feedbackNotes = ""
                        }
                ) {
                    Box(modifier = Modifier.padding(vertical = 11.dp), contentAlignment = Alignment.Center) {
                        Text("AJUSTES", style = MaterialTheme.typography.labelMedium, color = palette.tallyWarn)
                    }
                }

                Surface(
                    color = palette.stage,
                    shape = RoundedCornerShape(3.dp),
                    border = BorderStroke(1.dp, palette.tallyFault),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            viewModel.reviewVideo(video.id, ApprovalDecision.REJECTED, feedbackNotes)
                            feedbackNotes = ""
                        }
                ) {
                    Box(modifier = Modifier.padding(vertical = 11.dp), contentAlignment = Alignment.Center) {
                        Text("RECHAZAR", style = MaterialTheme.typography.labelMedium, color = palette.tallyFault)
                    }
                }
            }
        }

        // Consola de Emisión / Cola BullMQ (Exclusivo Agencia y Admin General)
        if (userRole != UserRole.CLIENTE && video.workflowStatus != VideoWorkflowStatus.PUBLISHED) {
            val isApproved = video.workflowStatus == VideoWorkflowStatus.APPROVED ||
                    video.workflowStatus == VideoWorkflowStatus.SCHEDULED

            HorizontalDivider(thickness = 1.dp, color = palette.hairline)

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "PUBLICACIÓN",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                OutlinedTextField(
                    value = scheduledDateInput,
                    onValueChange = { scheduledDateInput = it },
                    label = { Text("Fecha/hora programada (vacío = emitir ahora)") },
                    placeholder = { Text("2026-10-28 18:00") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Button(
                    onClick = {
                        viewModel.publishOrScheduleVideo(
                            videoId = video.id,
                            scheduledForIso = scheduledDateInput.takeIf { it.isNotBlank() }
                        )
                    },
                    enabled = isApproved,
                    shape = RoundedCornerShape(3.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.tallyLive,
                        contentColor = ColorWhiteOrInk(palette.isDark)
                    ),
                    modifier = Modifier.fillMaxWidth().height(44.dp)
                ) {
                    Text(
                        text = if (isApproved) {
                            "EMITIR EN ${video.targetPlatforms.size} CANALES SINCRONIZADOS →"
                        } else {
                            "BLOQUEADO · REQUIERE VISADO DEL CLIENTE"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
    }
}

@Composable
private fun ColorWhiteOrInk(isDark: Boolean) =
    if (isDark) androidx.compose.ui.graphics.Color(0xFF052E16)
    else androidx.compose.ui.graphics.Color.White
