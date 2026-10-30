package com.contentsync.app.domain.repository

import com.contentsync.app.domain.model.*
import kotlinx.coroutines.flow.Flow

interface ContentSyncRepository {
    val currentSessionFlow: Flow<UserSession?>
    val themeModeFlow: Flow<ThemeModePreference>
    val agenciesFlow: Flow<List<AgencyItem>>
    val clientsFlow: Flow<List<ClientItem>>
    val schedulesFlow: Flow<List<WeeklyScheduleItem>>
    val videosFlow: Flow<List<VideoItem>>
    val notificationsFlow: Flow<List<NotificationItem>>

    suspend fun loginWithEmail(email: String, password: String): Result<UserSession>
    suspend fun registerAccount(fullName: String, email: String, password: String, role: UserRole): Result<UserSession>
    suspend fun loginWithSocial(provider: SocialAuthProvider, idToken: String): Result<UserSession>
    suspend fun requestPasswordRecovery(email: String): Result<String>
    suspend fun resetPassword(token: String, newPassword: String): Result<String>
    suspend fun logout()
    suspend fun setThemeMode(mode: ThemeModePreference)

    // Gestión de Agencias (ADMIN_GENERAL)
    suspend fun createAgency(name: String, taxId: String, ownerName: String, ownerEmail: String, phone: String): Result<AgencyItem>
    suspend fun toggleAgencySuspension(agencyId: String): Result<Unit>
    suspend fun deleteAgency(agencyId: String): Result<Unit>

    // Gestión de Clientes (ADMIN_GENERAL y AGENCIA)
    suspend fun createClient(companyName: String, industry: String, contactName: String, contactEmail: String): Result<ClientItem>
    suspend fun deleteClient(clientId: String): Result<Unit>
    suspend fun toggleClientPlatformConnection(clientId: String, platform: SocialPlatform, handle: String): Result<Unit>

    // Cronogramas y Subida de Videos
    suspend fun createWeeklySchedule(clientId: String, weekStart: String, weekEnd: String, title: String, notes: String): Result<WeeklyScheduleItem>
    suspend fun uploadAndScheduleVideo(
        clientId: String,
        scheduleId: String,
        title: String,
        description: String,
        hashtags: List<String>,
        durationSeconds: Int,
        sizeMb: Double,
        dayOfWeek: Int,
        plannedTime: String,
        platforms: List<SocialPlatform>,
        shareToFeed: Boolean,
        allowComments: Boolean,
        allowDuetStitch: Boolean,
        madeForKids: Boolean,
        onProgress: (Float) -> Unit
    ): Result<VideoItem>

    // Flujo de Aprobación del Cliente
    suspend fun submitClientReview(
        videoId: String,
        decision: ApprovalDecision,
        feedbackNotes: String
    ): Result<VideoItem>
    suspend fun addVideoComment(videoId: String, message: String): Result<Unit>

    // Publicación Multiplataforma y Reintentos
    suspend fun publishOrScheduleApprovedVideo(videoId: String, scheduledForIso: String?): Result<VideoItem>
    suspend fun retryFailedPlatformPublication(videoId: String, platform: SocialPlatform): Result<VideoItem>
    suspend fun markNotificationRead(notificationId: String)
}
