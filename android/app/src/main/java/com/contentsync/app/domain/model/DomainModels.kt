package com.contentsync.app.domain.model

enum class UserRole {
    ADMIN_GENERAL,
    AGENCIA,
    CLIENTE
}

enum class SocialAuthProvider {
    GOOGLE,
    FACEBOOK,
    GITHUB
}

enum class SocialPlatform(val displayName: String, val maxDurationSec: Int, val maxSizeMb: Int) {
    INSTAGRAM("Instagram Reels", 900, 1024),
    TIKTOK("TikTok", 600, 500),
    YOUTUBE("YouTube Shorts", 180, 2048)
}

enum class VideoWorkflowStatus(val label: String) {
    DRAFT("Borrador"),
    IN_REVIEW("En Revisión"),
    CHANGES_REQUESTED("Cambios Solicitados"),
    REJECTED("Rechazado"),
    APPROVED("Aprobado"),
    SCHEDULED("Programado"),
    PUBLISHED("Publicado")
}

enum class ApprovalDecision(val label: String) {
    APPROVED("Aprobar"),
    CHANGES_REQUESTED("Pedir Cambios"),
    REJECTED("Rechazar")
}

enum class PublicationStatus(val label: String) {
    PENDING("Pendiente"),
    PROCESSING("Procesando"),
    PUBLISHED("Publicado"),
    FAILED("Error")
}

enum class ThemeModePreference {
    SYSTEM,
    LIGHT,
    DARK
}

data class UserSession(
    val id: String,
    val email: String,
    val fullName: String,
    val role: UserRole,
    val timezone: String,
    val emailVerified: Boolean,
    val agencyId: String?,
    val clientId: String?
)

data class AgencyItem(
    val id: String,
    val name: String,
    val taxId: String,
    val ownerEmail: String,
    val ownerFullName: String,
    val contactPhone: String,
    val isSuspended: Boolean,
    val clientsCount: Int
)

data class PlatformConnectionItem(
    val platform: SocialPlatform,
    val accountHandle: String,
    val isConnected: Boolean
)

data class ClientItem(
    val id: String,
    val agencyId: String,
    val agencyName: String,
    val companyName: String,
    val industry: String,
    val contactEmail: String,
    val contactFullName: String,
    val isActive: Boolean,
    val connections: List<PlatformConnectionItem>
)

data class PlatformPublicationState(
    val platform: SocialPlatform,
    val status: PublicationStatus,
    val scheduledFor: String,
    val publishedAt: String?,
    val externalPostUrl: String?,
    val lastErrorMessage: String?,
    val attemptsCount: Int
)

data class VideoCommentItem(
    val id: String,
    val authorName: String,
    val message: String,
    val createdAt: String
)

data class VideoItem(
    val id: String,
    val clientId: String,
    val clientName: String,
    val title: String,
    val description: String,
    val hashtags: List<String>,
    val durationSeconds: Int,
    val sizeMb: Double,
    val workflowStatus: VideoWorkflowStatus,
    val targetPlatforms: List<SocialPlatform>,
    val shareToFeed: Boolean,
    val allowComments: Boolean,
    val allowDuetStitch: Boolean,
    val madeForKids: Boolean,
    val dayOfWeek: Int,
    val plannedPublishAt: String,
    val comments: List<VideoCommentItem>,
    val publications: List<PlatformPublicationState>
)

data class WeeklyScheduleItem(
    val id: String,
    val clientId: String,
    val clientName: String,
    val weekStartDate: String,
    val weekEndDate: String,
    val title: String,
    val summaryNotes: String,
    val videos: List<VideoItem>
)

data class NotificationItem(
    val id: String,
    val title: String,
    val body: String,
    val createdAt: String,
    val isRead: Boolean
)
