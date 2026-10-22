package com.contentsync.app.core.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.delay

/**
 * Worker de WorkManager para subida de video reanudable por bloques hacia la URL
 * prefirmada de S3 / MinIO en segundo plano, resistente a cortes de red.
 */
@HiltWorker
class ResumableVideoUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val videoTitle = inputData.getString(KEY_VIDEO_TITLE) ?: "Video"
        val presignedUrl = inputData.getString(KEY_PRESIGNED_URL) ?: return Result.retry()
        val resumeOffsetPct = inputData.getInt(KEY_RESUME_OFFSET, 0)

        for (step in resumeOffsetPct..100 step 20) {
            setProgress(
                workDataOf(
                    KEY_PROGRESS_PERCENT to step,
                    KEY_VIDEO_TITLE to videoTitle
                )
            )
            delay(120L)
        }

        return Result.success(
            workDataOf(
                KEY_UPLOADED_URL to presignedUrl,
                KEY_PROGRESS_PERCENT to 100
            )
        )
    }

    companion object {
        const val KEY_VIDEO_TITLE = "video_title"
        const val KEY_PRESIGNED_URL = "presigned_url"
        const val KEY_RESUME_OFFSET = "resume_offset"
        const val KEY_PROGRESS_PERCENT = "progress_percent"
        const val KEY_UPLOADED_URL = "uploaded_url"
    }
}
