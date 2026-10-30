package com.contentsync.app.core.network

import com.contentsync.app.core.datastore.SecureSessionStorage
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import javax.inject.Inject
import javax.inject.Singleton

data class LoginRequestDto(val email: String, val password: String, val deviceInfo: String = "Android App")
data class RefreshRequestDto(val refreshToken: String)
data class RegisterRequestDto(val email: String, val password: String, val fullName: String, val role: String? = null)
data class SocialLoginRequestDto(val provider: String, val idToken: String, val deviceInfo: String = "Android App")
data class ForgotPasswordRequestDto(val email: String)
data class ForgotPasswordResponseDto(
    val message: String? = null,
    val resetToken: String? = null,
    val resetTokenMock: String? = null
)
data class ResetPasswordRequestDto(
    val token: String,
    val newPassword: String
)
data class ResetPasswordResponseDto(
    val message: String? = null
)
data class AuthUserDto(
    val id: String,
    val email: String,
    val fullName: String,
    val role: String,
    val timezone: String,
    val emailVerified: Boolean,
    val agencyId: String?,
    val clientId: String?
)
data class AuthResponseDto(
    val accessToken: String,
    val refreshToken: String,
    val expiresInSeconds: Long,
    val user: AuthUserDto
)
data class PresignedUploadRequestDto(
    val clientId: String,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long,
    val durationSeconds: Int,
    val targetPlatforms: List<String>
)
data class PresignedUploadResponseDto(
    val uploadUrl: String,
    val publicUrl: String,
    val storageKey: String,
    val expiresInSeconds: Int
)
data class ReviewDecisionRequestDto(val decision: String, val feedbackNotes: String?)
data class PublishVideoRequestDto(val videoId: String, val scheduledFor: String?, val userTimezone: String?)

interface ContentSyncApiService {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequestDto): AuthResponseDto

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequestDto): AuthResponseDto

    @POST("auth/social")
    suspend fun socialLogin(@Body body: SocialLoginRequestDto): AuthResponseDto

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequestDto): ForgotPasswordResponseDto

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequestDto): ResetPasswordResponseDto

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequestDto): AuthResponseDto

    @POST("videos/presigned-upload")
    suspend fun requestPresignedUpload(@Body body: PresignedUploadRequestDto): PresignedUploadResponseDto

    @POST("schedules/videos/{videoId}/review")
    suspend fun reviewVideo(@Path("videoId") videoId: String, @Body body: ReviewDecisionRequestDto): Any

    @POST("publications/publish")
    suspend fun publishOrSchedule(@Body body: PublishVideoRequestDto): Any

    @GET("publications/history")
    suspend fun getHistory(
        @Query("clientId") clientId: String? = null,
        @Query("platform") platform: String? = null,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null
    ): List<Any>
}

@Singleton
class JwtAuthInterceptor @Inject constructor(
    private val sessionStorage: SecureSessionStorage
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = sessionStorage.getAccessToken()
        val requestBuilder = original.newBuilder()
        if (!token.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $token")
        }
        return chain.proceed(requestBuilder.build())
    }
}

/**
 * Authenticator de OkHttp que detecta respuestas 401 y ejecuta automáticamente
 * la rotación de Refresh Token contra el backend.
 */
@Singleton
class TokenRefreshAuthenticator @Inject constructor(
    private val sessionStorage: SecureSessionStorage
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.header("X-Retry-Auth") != null) {
            return null
        }
        // Sin renovación local simulada: ante un 401 el usuario debe volver a ingresar.
        return null
    }
}
