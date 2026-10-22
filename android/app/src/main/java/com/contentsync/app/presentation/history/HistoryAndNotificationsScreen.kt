package com.contentsync.app.presentation.history

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.PublicationStatusRow
import com.contentsync.app.core.designsystem.WorkflowStatusBadge
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
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Historial de Publicaciones y Filtros",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = uiState.historySearchQuery,
                onValueChange = { viewModel.updateHistoryFilters(search = it) },
                label = { Text("Buscar por título, descripción o cliente...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        }

        // Filtro por Plataforma
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = uiState.historyPlatformFilter == null,
                    onClick = { viewModel.updateHistoryFilters(platform = null) },
                    label = { Text("Todas las Redes") }
                )
                SocialPlatform.entries.forEach { platform ->
                    FilterChip(
                        selected = uiState.historyPlatformFilter == platform,
                        onClick = {
                            val next = if (uiState.historyPlatformFilter == platform) null else platform
                            viewModel.updateHistoryFilters(platform = next)
                        },
                        label = { Text(platform.name) }
                    )
                }
            }
        }

        // Filtro por Estado de Publicación
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = uiState.historyStatusFilter == null,
                    onClick = { viewModel.updateHistoryFilters(status = null) },
                    label = { Text("Todos los Estados") }
                )
                PublicationStatus.entries.forEach { st ->
                    FilterChip(
                        selected = uiState.historyStatusFilter == st,
                        onClick = {
                            val next = if (uiState.historyStatusFilter == st) null else st
                            viewModel.updateHistoryFilters(status = next)
                        },
                        label = { Text(st.label) }
                    )
                }
            }
        }

        if (filteredVideos.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "Sin resultados para los filtros seleccionados",
                    subtitle = "Prueba limpiando el buscador o cambiando la plataforma seleccionada."
                )
            }
        }

        items(filteredVideos, key = { "hist-${it.id}" }) { video ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(video.title, fontWeight = FontWeight.Bold)
                            Text(
                                "${video.clientName} • ${video.plannedPublishAt}",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        WorkflowStatusBadge(video.workflowStatus)
                    }

                    if (video.publications.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        video.publications.forEach { pub ->
                            PublicationStatusRow(
                                platform = pub.platform,
                                status = pub.status,
                                errorMsg = pub.lastErrorMessage
                            )
                            if (pub.status == PublicationStatus.FAILED &&
                                uiState.session?.role != UserRole.CLIENTE
                            ) {
                                TextButton(
                                    onClick = { viewModel.retryFailedPlatform(video.id, pub.platform) }
                                ) {
                                    Text("Reintentar publicación en ${pub.platform.displayName}")
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text(
                text = "Centro de Notificaciones Push (FCM)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        items(uiState.notifications, key = { it.id }) { notif ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (notif.isRead) MaterialTheme.colorScheme.surface
                    else MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(notif.title, fontWeight = FontWeight.Bold)
                        Text(notif.body, style = MaterialTheme.typography.bodySmall)
                        Text(notif.createdAt, style = MaterialTheme.typography.labelSmall)
                    }
                    if (!notif.isRead) {
                        TextButton(onClick = { viewModel.markNotificationRead(notif.id) }) {
                            Text("Marcar leída")
                        }
                    }
                }
            }
        }
    }
}
