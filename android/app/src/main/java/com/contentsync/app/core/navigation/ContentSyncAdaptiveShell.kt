package com.contentsync.app.core.navigation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel
import com.contentsync.app.presentation.auth.AuthScreen
import com.contentsync.app.presentation.history.HistoryAndNotificationsScreen
import com.contentsync.app.presentation.schedules.SchedulesAndApprovalsScreen
import com.contentsync.app.presentation.settings.SettingsScreen
import com.contentsync.app.presentation.users.UsersAndAgenciesScreen
import com.contentsync.app.presentation.videos.VideoUploadScreen

enum class AppDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val allowedRoles: Set<UserRole>
) {
    SCHEDULES(
        route = "schedules",
        label = "Cronogramas",
        icon = Icons.Default.CalendarMonth,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    UPLOAD(
        route = "upload",
        label = "Subir Video",
        icon = Icons.Default.CloudUpload,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA)
    ),
    USERS_AGENCIES(
        route = "users_agencies",
        label = "Clientes/Agencias",
        icon = Icons.Default.Business,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    HISTORY(
        route = "history",
        label = "Historial",
        icon = Icons.Default.History,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    SETTINGS(
        route = "settings",
        label = "Ajustes",
        icon = Icons.Default.Settings,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContentSyncAdaptiveShell(
    windowSizeClass: WindowSizeClass,
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val session = uiState.session
    if (session == null) {
        Scaffold { padding ->
            Column(modifier = Modifier.padding(padding).fillMaxSize()) {
                FeedbackBanner(uiState = uiState, onDismiss = viewModel::clearBanner)
                AuthScreen(viewModel = viewModel)
            }
        }
        return
    }

    val visibleDestinations = remember(session.role) {
        AppDestination.entries.filter { session.role in it.allowedRoles }
    }
    var currentDest by remember(session.role) {
        mutableStateOf(visibleDestinations.first())
    }

    val useNavRail = windowSizeClass.widthSizeClass != WindowWidthSizeClass.Compact
    val unreadNotificationsCount = uiState.notifications.count { !it.isRead }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "ContentSync • ${session.role.name}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${session.fullName} (${session.timezone})",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                },
                actions = {
                    if (unreadNotificationsCount > 0) {
                        Badge(modifier = Modifier.padding(end = 16.dp)) {
                            Text("$unreadNotificationsCount nuevas")
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (!useNavRail) {
                NavigationBar {
                    visibleDestinations.forEach { dest ->
                        NavigationBarItem(
                            selected = currentDest == dest,
                            onClick = { currentDest = dest },
                            icon = { Icon(dest.icon, contentDescription = dest.label) },
                            label = { Text(dest.label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (useNavRail) {
                NavigationRail {
                    visibleDestinations.forEach { dest ->
                        NavigationRailItem(
                            selected = currentDest == dest,
                            onClick = { currentDest = dest },
                            icon = { Icon(dest.icon, contentDescription = dest.label) },
                            label = { Text(dest.label) }
                        )
                    }
                }
            }

            Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                FeedbackBanner(uiState = uiState, onDismiss = viewModel::clearBanner)

                when (currentDest) {
                    AppDestination.SCHEDULES -> SchedulesAndApprovalsScreen(uiState, viewModel)
                    AppDestination.UPLOAD -> VideoUploadScreen(uiState, viewModel)
                    AppDestination.USERS_AGENCIES -> UsersAndAgenciesScreen(uiState, viewModel)
                    AppDestination.HISTORY -> HistoryAndNotificationsScreen(uiState, viewModel)
                    AppDestination.SETTINGS -> SettingsScreen(uiState, viewModel)
                }
            }
        }
    }
}

@Composable
private fun FeedbackBanner(uiState: ContentSyncUiState, onDismiss: () -> Unit) {
    val msg = uiState.bannerMessage ?: return
    Surface(
        color = if (uiState.isErrorBanner) MaterialTheme.colorScheme.errorContainer
        else MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = msg,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onDismiss) {
                Text("Cerrar")
            }
        }
    }
}
