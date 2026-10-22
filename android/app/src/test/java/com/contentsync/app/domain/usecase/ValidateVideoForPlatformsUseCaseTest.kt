package com.contentsync.app.domain.usecase

import com.contentsync.app.domain.model.*
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidateVideoForPlatformsUseCaseTest {

    private val useCase = ValidateVideoForPlatformsUseCase()

    @Test
    fun `validatePasswordStrength accepts strong password and rejects weak password`() {
        assertTrue(useCase.validatePasswordStrength("ContentSync2026!").isSuccess)
        assertTrue(useCase.validatePasswordStrength("weak123").isFailure)
    }

    @Test
    fun `validateVideoSpecs accepts 45s MP4 across Instagram Reels, TikTok and YouTube Shorts`() {
        val result = useCase.validateVideoSpecs(
            durationSeconds = 45,
            sizeMb = 28.5,
            mimeType = "video/mp4",
            platforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE)
        )
        assertTrue(result.isSuccess)
    }

    @Test
    fun `validateVideoSpecs rejects 240s video when YouTube Shorts is selected`() {
        val result = useCase.validateVideoSpecs(
            durationSeconds = 240,
            sizeMb = 35.0,
            mimeType = "video/mp4",
            platforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.YOUTUBE)
        )
        assertTrue(result.isFailure)
    }

    @Test
    fun `canPublishVideo blocks unapproved videos and allows approved videos`() {
        val draftVideo = VideoItem(
            id = "v1",
            clientId = "c1",
            clientName = "Kafecito",
            title = "Demo",
            description = "Desc",
            hashtags = listOf("cafe"),
            durationSeconds = 30,
            sizeMb = 15.0,
            workflowStatus = VideoWorkflowStatus.IN_REVIEW,
            targetPlatforms = listOf(SocialPlatform.INSTAGRAM),
            shareToFeed = true,
            allowComments = true,
            allowDuetStitch = true,
            madeForKids = false,
            dayOfWeek = 1,
            plannedPublishAt = "2026-10-23 18:00",
            comments = emptyList(),
            publications = emptyList()
        )
        assertTrue(useCase.canPublishVideo(draftVideo).isFailure)

        val approvedVideo = draftVideo.copy(workflowStatus = VideoWorkflowStatus.APPROVED)
        assertTrue(useCase.canPublishVideo(approvedVideo).isSuccess)
    }

    @Test
    fun `validateClientReviewInput requires feedback notes when requesting changes or rejecting`() {
        assertTrue(
            useCase.validateClientReviewInput(ApprovalDecision.CHANGES_REQUESTED, "").isFailure
        )
        assertTrue(
            useCase.validateClientReviewInput(
                ApprovalDecision.CHANGES_REQUESTED,
                "Ajustar subtítulos en segundo 10"
            ).isSuccess
        )
    }
}
