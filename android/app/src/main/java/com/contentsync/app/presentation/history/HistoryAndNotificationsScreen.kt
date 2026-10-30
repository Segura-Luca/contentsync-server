package com.contentsync.app.presentation.history

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.PublicationStatusRow
import com.contentsync.app.core.designsystem.StudioSectionHeader
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.TriSyncConduit
import com.contentsync.app.core.designsystem.WorkflowStatusBadge
import com.contentsync.app.core.designsystem.shortCode
import com.contentsync.app.domain.model.PublicationStatus
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun HistoryAndNotificationsScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val palette = StudioTheme.colors

    val filteredVideos = remember(
        uiState.videos,
        uiState.historySearchQuery,
        uiState.historyPlatformFilter,
        uiState.historyStatusFilter,
        uiState.historyClientIdFilter
    ) {
        uiState.videos.filter { video ->
            val matchesQuery = uiState.historySearchQuery.isBlank() ||
                    video.title.contains(uiState.historySearchQuery, ignoreCase = true) ||
                    video.description.contains(uiState.historySearchQuery, ignoreCase = true) ||
                    video.clientName.contains(uiState.historySearchQuery, ignoreCase = true)

            val matchesClient = uiState.historyClientIdFilter == null ||
                    video.clientId == uiState.historyClientIdFilter

            val matchesPlatform = uiState.historyPlatformFilter == null ||
                    video.targetPlatforms.contains(uiState.historyPlatformFilter)

            val matchesStatus = uiState.historyStatusFilter == null ||
                    video.publications.any { it.status == uiState.historyStatusFilter }

            matchesQuery && matchesClient && matchesPlatform && matchesStatus
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            StudioSectionHeader(
                eyebrow = "AUDITORÍA DE EMISIÓN · TRAZABILIDAD POR RED",
                title = "Bitácora & Señales Push",
                subtitle = "Seguimiento de tus publicaciones, reintentos y avisos en tiempo real."
            )
            Spacer(modifier = Modifier.height(10.dp))
            OutlinedTextField(
                value = uiState.historySearchQuery,
                onValueChange = { viewModel.updateHistoryFilters(search = it) },
                label = { Text("Filtrar por pieza, copy o marca...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        }

        // Filtro por Canal
        item {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AuditFilterChip(
                    label = "TODOS LOS CANALES",
                    selected = uiState.historyPlatformFilter == null,
                    onClick = { viewModel.updateHistoryFilters(platform = null) }
                )
                SocialPlatform.entries.forEach { platform ->
                    AuditFilterChip(
                        label = "${platform.shortCode} · ${platform.displayName}",
                        selected = uiState.historyPlatformFilter == platform,
                        onClick = {
                            val next = if (uiState.historyPlatformFilter == platform) null else platform
                            viewModel.updateHistoryFilters(platform = next)
                        }
                    )
                }
            }
        }

        // Filtro por Estado Técnico
        item {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AuditFilterChip(
                    label = "TODOS LOS ESTADOS",
                    selected = uiState.historyStatusFilter == null,
                    onClick = { viewModel.updateHistoryFilters(status = null) }
                )
                PublicationStatus.entries.forEach { st ->
                    AuditFilterChip(
                        label = st.label.uppercase(),
                        selected = uiState.historyStatusFilter == st,
                        onClick = {
                            val next = if (uiState.historyStatusFilter == st) null else st
                            viewModel.updateHistoryFilters(status = next)
                        }
                    )
                }
            }
        }

        if (filteredVideos.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "Sin registros que coincidan con el filtro",
                    subtitle = "Restablecé los parámetros de canal o búsqueda para inspeccionar todas las piezas auditadas.",
                    actionLabel = "Limpiar Filtros",
                    onAction = {
                        viewModel.updateHistoryFilters(search = "", platform = null, status = null, clientId = null)
                    }
                )
            }
        }

        items(filteredVideos, key = { "hist-${it.id}" }) { video ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
                    .background(palette.stage, RoundedCornerShape(3.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${video.clientName.uppercase()} · ${video.plannedPublishAt}",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textMuted
                        )
                        Text(
                            text = video.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.textPrimary
                        )
                    }
                    WorkflowStatusBadge(video.workflowStatus)
                }

                TriSyncConduit(
                    targetPlatforms = video.targetPlatforms,
                    publications = video.publications,
                    workflowStatus = video.workflowStatus
                )

                if (video.publications.isNotEmpty()) {
                    video.publications.forEach { pub ->
                        PublicationStatusRow(
                            platform = pub.platform,
                            status = pub.status,
                            errorMsg = pub.lastErrorMessage,
                            onRetry = if (uiState.session?.role != UserRole.CLIENTE) {
                                { viewModel.retryFailedPlatform(video.id, pub.platform) }
                            } else null
                        )
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(thickness = 1.dp, color = palette.hairline)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "AVISOS RECIBIDOS",
                style = MaterialTheme.typography.labelLarge,
                color = palette.textPrimary
            )
        }

        if (uiState.notifications.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "Bandeja de señales al día",
                    subtitle = "Las alertas de aprobación, cambios solicitados y fallos de conexión aparecerán aquí."
                )
            }
        }

        items(uiState.notifications, key = { it.id }) { notif ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        if (notif.isRead) palette.hairline else palette.signalAccent.copy(alpha = 0.6f),
                        RoundedCornerShape(3.dp)
                    )
                    .background(
                        if (notif.isRead) palette.stage else palette.inspector,
                        RoundedCornerShape(3.dp)
                    )
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        modifier = Modifier
                            .padding(top = 5.dp)
                            .size(6.dp)
                            .background(
                                if (notif.isRead) palette.textMuted else palette.signalAccent,
                                RoundedCornerShape(1.dp)
                            )
                    )
                    Column {
                        Text(
                            text = notif.title,
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = notif.body,
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                        Text(
                            text = notif.createdAt,
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textMuted
                        )
                    }
                }
                if (!notif.isRead) {
                    Text(
                        text = "LEÍDA",
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.signalSubtleText,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .border(1.dp, palette.borderStrong, RoundedCornerShape(2.dp))
                            .clickable { viewModel.markNotificationRead(notif.id) }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun AuditFilterChip(
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
            if (selected) palette.signalSubtleText.copy(alpha = 0.65f) else palette.hairline
        ),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) palette.signalSubtleText else palette.textSecondary,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp)
        )
    }
}
