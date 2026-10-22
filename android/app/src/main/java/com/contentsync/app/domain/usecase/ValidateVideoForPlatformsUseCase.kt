package com.contentsync.app.domain.usecase

import com.contentsync.app.domain.model.ApprovalDecision
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.VideoItem
import com.contentsync.app.domain.model.VideoWorkflowStatus
import javax.inject.Inject

/**
 * Casos de uso de dominio puros para validar reglas de negocio en el cliente Android
 * en espejado con el Backend NestJS.
 */
class ValidateVideoForPlatformsUseCase @Inject constructor() {

    private val strongPasswordRegex =
        Regex("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d])[A-Za-z\\d\\S]{8,64}$")

    fun validatePasswordStrength(password: String): Result<Unit> {
        if (!strongPasswordRegex.matches(password)) {
            return Result.failure(
                IllegalArgumentException(
                    "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo."
                )
            )
        }
        return Result.success(Unit)
    }

    fun validateVideoSpecs(
        durationSeconds: Int,
        sizeMb: Double,
        mimeType: String,
        platforms: List<SocialPlatform>
    ): Result<Unit> {
        if (platforms.isEmpty()) {
            return Result.failure(IllegalArgumentException("Debes seleccionar al menos una plataforma destino."))
        }
        if (durationSeconds < 3) {
            return Result.failure(IllegalArgumentException("La duración mínima del video es de 3 segundos."))
        }
        val normalizedMime = mimeType.lowercase().trim()
        if (normalizedMime != "video/mp4" && normalizedMime != "video/quicktime") {
            return Result.failure(IllegalArgumentException("Formato no compatible. Usa MP4 (H.264) o MOV."))
        }

        for (platform in platforms) {
            if (durationSeconds > platform.maxDurationSec) {
                return Result.failure(
                    IllegalArgumentException(
                        "${platform.displayName} admite máximo ${platform.maxDurationSec}s y tu video dura ${durationSeconds}s."
                    )
                )
            }
            if (sizeMb > platform.maxSizeMb) {
                return Result.failure(
                    IllegalArgumentException(
                        "${platform.displayName} admite máximo ${platform.maxSizeMb} MB y tu archivo pesa ${sizeMb} MB."
                    )
                )
            }
        }
        return Result.success(Unit)
    }

    fun canPublishVideo(video: VideoItem): Result<Unit> {
        if (video.workflowStatus != VideoWorkflowStatus.APPROVED &&
            video.workflowStatus != VideoWorkflowStatus.SCHEDULED
        ) {
            return Result.failure(
                IllegalStateException(
                    "Solo los videos APROBADOS por el cliente pueden publicarse (estado actual: ${video.workflowStatus.label})."
                )
            )
        }
        return Result.success(Unit)
    }

    fun validateClientReviewInput(decision: ApprovalDecision, notes: String): Result<Unit> {
        if ((decision == ApprovalDecision.CHANGES_REQUESTED || decision == ApprovalDecision.REJECTED) &&
            notes.trim().length < 3
        ) {
            return Result.failure(
                IllegalArgumentException("Por favor escribe una nota indicando los cambios solicitados o el motivo de rechazo.")
            )
        }
        return Result.success(Unit)
    }
}
