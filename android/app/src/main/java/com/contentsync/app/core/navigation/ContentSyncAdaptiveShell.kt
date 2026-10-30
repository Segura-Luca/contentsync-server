package com.contentsync.app.core.navigation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.CalendarViewWeek
import androidx.compose.material.icons.outlined.Contrast
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.StudioTallyDot
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.TriSyncBrandMark
import com.contentsync.app.domain.model.ThemeModePreference
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
    val shortCode: String,
    val icon: ImageVector,
    val allowedRoles: Set<UserRole>
) {
    SCHEDULES(
        route = "schedules",
        label = "Plan",
        shortCode = "01",
        icon = Icons.Outlined.CalendarViewWeek,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    UPLOAD(
        route = "upload",
        label = "Subir",
        shortCode = "02",
        icon = Icons.Outlined.FileUpload,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA)
    ),
    USERS_AGENCIES(
        route = "users_agencies",
        label = "Clientes",
        shortCode = "03",
        icon = Icons.Outlined.AccountTree,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    HISTORY(
        route = "history",
        label = "Historial",
        shortCode = "04",
        icon = Icons.Outlined.History,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    ),
    SETTINGS(
        route = "settings",
        label = "Ajustes",
        shortCode = "05",
        icon = Icons.Outlined.Tune,
        allowedRoles = setOf(UserRole.ADMIN_GENERAL, UserRole.AGENCIA, UserRole.CLIENTE)
    )
}

@Composable
fun ContentSyncAdaptiveShell(
    windowSizeClass: WindowSizeClass,
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val palette = StudioTheme.colors
    val isWideScreen = windowSizeClass.widthSizeClass != WindowWidthSizeClass.Compact
    val session = uiState.session

    if (session == null) {
        Scaffold(
            containerColor = palette.canvas
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .background(palette.canvas)
            ) {
                if (uiState.isLoading) {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().height(2.dp),
                        color = palette.signalAccent,
                        trackColor = palette.hairline
                    )
                }
                FeedbackBanner(uiState = uiState, onDismiss = viewModel::clearBanner)
                AuthScreen(
                    viewModel = viewModel,
                    uiState = uiState,
                    isWideScreen = isWideScreen
                )
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

    val unreadNotificationsCount = uiState.notifications.count { !it.isRead }

    Scaffold(
        containerColor = palette.canvas,
        topBar = {
            StudioTopTelemetryBar(
                role = session.role,
                fullName = session.fullName,
                timezone = session.timezone,
                unreadCount = unreadNotificationsCount,
                isSyncing = uiState.isLoading || uiState.uploadProgress > 0f,
                isDark = palette.isDark,
                onToggleTheme = {
                    val next = if (palette.isDark) ThemeModePreference.LIGHT else ThemeModePreference.DARK
                    viewModel.setThemeMode(next)
                },
                onOpenHistory = { currentDest = AppDestination.HISTORY }
            )
        },
        bottomBar = {
            if (!isWideScreen) {
                StudioBottomCommandBar(
                    destinations = visibleDestinations,
                    currentDest = currentDest,
                    onSelect = { currentDest = it }
                )
            }
        }
    ) { innerPadding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(palette.canvas)
        ) {
            if (isWideScreen) {
                StudioSideRail(
                    destinations = visibleDestinations,
                    currentDest = currentDest,
                    onSelect = { currentDest = it }
                )
                VerticalDivider(thickness = 1.dp, color = palette.hairline)
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(palette.canvas)
            ) {
                if (uiState.isLoading) {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().height(2.dp),
                        color = palette.signalAccent,
                        trackColor = palette.hairline
                    )
                }

                FeedbackBanner(uiState = uiState, onDismiss = viewModel::clearBanner)

                AnimatedContent(
                    targetState = currentDest,
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(190)) +
                            slideInVertically(animationSpec = tween(210)) { fullHeight -> fullHeight / 32 })
                            .togetherWith(fadeOut(animationSpec = tween(110)))
                    },
                    label = "studioDestinationTransition",
                    modifier = Modifier.fillMaxSize()
                ) { targetDest ->
                    when (targetDest) {
                        AppDestination.SCHEDULES -> SchedulesAndApprovalsScreen(
                            uiState = uiState,
                            viewModel = viewModel,
                            isWideScreen = isWideScreen,
                            onNavigateToUpload = {
                                if (AppDestination.UPLOAD in visibleDestinations) {
                                    currentDest = AppDestination.UPLOAD
                                }
                            }
                        )
                        AppDestination.UPLOAD -> VideoUploadScreen(uiState, viewModel)
                        AppDestination.USERS_AGENCIES -> UsersAndAgenciesScreen(uiState, viewModel)
                        AppDestination.HISTORY -> HistoryAndNotificationsScreen(uiState, viewModel)
                        AppDestination.SETTINGS -> SettingsScreen(uiState, viewModel)
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioTopTelemetryBar(
    role: UserRole,
    fullName: String,
    timezone: String,
    unreadCount: Int,
    isSyncing: Boolean,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onOpenHistory: () -> Unit
) {
    val palette = StudioTheme.colors
    val roleTag = when (role) {
        UserRole.ADMIN_GENERAL -> "ADMIN GENERAL"
        UserRole.AGENCIA -> "AGENCIA"
        UserRole.CLIENTE -> "CLIENTE"
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.stage)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                TriSyncBrandMark(isActive = isSyncing)
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "ContentSync",
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.textPrimary,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(
                            color = palette.signalSubtleBg,
                            shape = RoundedCornerShape(2.dp),
                            border = BorderStroke(1.dp, palette.signalSubtleText.copy(alpha = 0.4f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                StudioTallyDot(color = palette.tallyLive, size = 5.dp)
                                Text(
                                    text = roleTag,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.signalSubtleText,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    Text(
                        text = fullName,
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (unreadCount > 0) {
                    Surface(
                        color = palette.tallyWarnBg,
                        shape = RoundedCornerShape(2.dp),
                        border = BorderStroke(1.dp, palette.tallyWarn),
                        modifier = Modifier.clickable(onClick = onOpenHistory)
                    ) {
                        Text(
                            text = if (unreadCount == 1) "1 aviso" else "$unreadCount avisos",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.tallyWarn,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp)
                        )
                    }
                }

                Surface(
                    color = palette.elevated,
                    shape = RoundedCornerShape(3.dp),
                    border = BorderStroke(1.dp, palette.borderStrong),
                    modifier = Modifier.clickable(onClick = onToggleTheme)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Contrast,
                            contentDescription = "Alternar calibración óptica",
                            tint = palette.textPrimary,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = if (isDark) "DARK" else "LIGHT",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textPrimary
                        )
                    }
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = palette.hairline)
    }
}

@Composable
private fun StudioSideRail(
    destinations: List<AppDestination>,
    currentDest: AppDestination,
    onSelect: (AppDestination) -> Unit
) {
    val palette = StudioTheme.colors
    Column(
        modifier = Modifier
            .width(96.dp)
            .fillMaxHeight()
            .background(palette.stage)
            .padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        destinations.forEach { dest ->
            val selected = dest == currentDest
            val itemBg by animateColorAsState(
                targetValue = if (selected) palette.inspector else palette.stage,
                animationSpec = tween(180),
                label = "railBg"
            )
            val indicatorHeight by animateDpAsState(
                targetValue = if (selected) 32.dp else 0.dp,
                animationSpec = tween(200),
                label = "railBarHeight"
            )
            val contentTint by animateColorAsState(
                targetValue = if (selected) palette.textPrimary else palette.textMuted,
                animationSpec = tween(180),
                label = "railTint"
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSelect(dest) }
                    .background(itemBg)
                    .padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .height(indicatorHeight)
                            .background(palette.signalAccent)
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = dest.icon,
                        contentDescription = dest.label,
                        tint = contentTint,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = dest.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = contentTint,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

@Composable
private fun StudioBottomCommandBar(
    destinations: List<AppDestination>,
    currentDest: AppDestination,
    onSelect: (AppDestination) -> Unit
) {
    val palette = StudioTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.stage)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(thickness = 1.dp, color = palette.hairline)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            destinations.forEach { dest ->
                val selected = dest == currentDest
                val indicatorFrac by androidx.compose.animation.core.animateFloatAsState(
                    targetValue = if (selected) 0.65f else 0f,
                    animationSpec = tween(200),
                    label = "bottomBarFrac"
                )
                val contentTint by animateColorAsState(
                    targetValue = if (selected) palette.textPrimary else palette.textMuted,
                    animationSpec = tween(180),
                    label = "bottomTint"
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelect(dest) }
                        .padding(bottom = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(indicatorFrac)
                            .height(2.dp)
                            .background(palette.signalAccent)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Icon(
                        imageVector = dest.icon,
                        contentDescription = dest.label,
                        tint = contentTint,
                        modifier = Modifier.size(19.dp)
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = dest.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = contentTint,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

@Composable
private fun FeedbackBanner(uiState: ContentSyncUiState, onDismiss: () -> Unit) {
    val palette = StudioTheme.colors
    val isErr = uiState.isErrorBanner
    val bg = if (isErr) palette.tallyFaultBg else palette.signalSubtleBg
    val fg = if (isErr) palette.tallyFault else palette.signalSubtleText
    val tag = if (isErr) "[FALLO]" else "[OK]"

    AnimatedVisibility(
        visible = uiState.bannerMessage != null,
        enter = expandVertically(animationSpec = tween(180)) + fadeIn(animationSpec = tween(180)),
        exit = shrinkVertically(animationSpec = tween(150)) + fadeOut(animationSpec = tween(120))
    ) {
        val msg = uiState.bannerMessage.orEmpty()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(bg)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = msg,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Cerrar",
                    style = MaterialTheme.typography.labelSmall,
                    color = fg,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(2.dp))
                        .clickable(onClick = onDismiss)
                        .padding(horizontal = 7.dp, vertical = 3.dp)
                )
            }
            HorizontalDivider(thickness = 1.dp, color = fg.copy(alpha = 0.35f))
        }
    }
}
