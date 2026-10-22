package com.contentsync.app.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.contentsync.app.domain.model.*
import com.contentsync.app.domain.repository.ContentSyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ContentSyncUiState(
    val session: UserSession? = null,
    val themeMode: ThemeModePreference = ThemeModePreference.SYSTEM,
    val agencies: List<AgencyItem> = emptyList(),
    val clients: List<ClientItem> = emptyList(),
    val schedules: List<WeeklyScheduleItem> = emptyList(),
    val videos: List<VideoItem> = emptyList(),
    val notifications: List<NotificationItem> = emptyList(),
    val isLoading: Boolean = false,
    val uploadProgress: Float = 0f,
    val bannerMessage: String? = null,
    val isErrorBanner: Boolean = false,
    // Filtros de Historial
    val historySearchQuery: String = "",
    val historyPlatformFilter: SocialPlatform? = null,
    val historyStatusFilter: PublicationStatus? = null,
    val historyClientIdFilter: String? = null
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val repository: ContentSyncRepository
) : ViewModel() {

    private val _transientState = MutableStateFlow(TransientUiState())

    private data class TransientUiState(
        val isLoading: Boolean = false,
        val uploadProgress: Float = 0f,
        val bannerMessage: String? = null,
        val isErrorBanner: Boolean = false,
        val historySearchQuery: String = "",
        val historyPlatformFilter: SocialPlatform? = null,
        val historyStatusFilter: PublicationStatus? = null,
        val historyClientIdFilter: String? = null
    )

    val uiState: StateFlow<ContentSyncUiState> = combine(
        repository.currentSessionFlow,
        repository.themeModeFlow,
        repository.agenciesFlow,
        repository.clientsFlow,
        repository.schedulesFlow,
        repository.videosFlow,
        repository.notificationsFlow,
        _transientState
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val session = values[0] as UserSession?
        val theme = values[1] as ThemeModePreference
        @Suppress("UNCHECKED_CAST")
        val agencies = values[2] as List<AgencyItem>
        @Suppress("UNCHECKED_CAST")
        val clients = values[3] as List<ClientItem>
        @Suppress("UNCHECKED_CAST")
        val schedules = values[4] as List<WeeklyScheduleItem>
        @Suppress("UNCHECKED_CAST")
        val videos = values[5] as List<VideoItem>
        @Suppress("UNCHECKED_CAST")
        val notifications = values[6] as List<NotificationItem>
        val transient = values[7] as TransientUiState

        ContentSyncUiState(
            session = session,
            themeMode = theme,
            agencies = agencies,
            clients = clients,
            schedules = schedules,
            videos = videos,
            notifications = notifications,
            isLoading = transient.isLoading,
            uploadProgress = transient.uploadProgress,
            bannerMessage = transient.bannerMessage,
            isErrorBanner = transient.isErrorBanner,
            historySearchQuery = transient.historySearchQuery,
            historyPlatformFilter = transient.historyPlatformFilter,
            historyStatusFilter = transient.historyStatusFilter,
            historyClientIdFilter = transient.historyClientIdFilter
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = ContentSyncUiState()
    )

    fun clearBanner() {
        _transientState.update { it.copy(bannerMessage = null, isErrorBanner = false) }
    }

    private fun showFeedback(msg: String, isError: Boolean = false) {
        _transientState.update {
            it.copy(isLoading = false, bannerMessage = msg, isErrorBanner = isError)
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _transientState.update { it.copy(isLoading = true, bannerMessage = null) }
            repository.loginWithEmail(email, password)
                .onSuccess { session ->
                    showFeedback("Bienvenido/a ${session.fullName} (${session.role.name})")
                }
                .onFailure { err ->
                    showFeedback(err.message ?: "Error al iniciar sesión", isError = true)
                }
        }
    }

    fun register(fullName: String, email: String, password: String, role: UserRole) {
        viewModelScope.launch {
            _transientState.update { it.copy(isLoading = true, bannerMessage = null) }
            repository.registerAccount(fullName, email, password, role)
                .onSuccess { session ->
                    showFeedback("Cuenta registrada y verificada para ${session.email}")
                }
                .onFailure { err ->
                    showFeedback(err.message ?: "Error en el registro", isError = true)
                }
        }
    }

    fun loginSocial(provider: SocialAuthProvider, email: String, fullName: String) {
        viewModelScope.launch {
            repository.loginWithSocial(provider, email, fullName)
                .onSuccess { session ->
                    showFeedback("Sesión iniciada con ${provider.name} vinculada a ${session.email}")
                }
                .onFailure { err ->
                    showFeedback(err.message ?: "Error en login social", isError = true)
                }
        }
    }

    fun recoverPassword(email: String) {
        viewModelScope.launch {
            repository.requestPasswordRecovery(email)
                .onSuccess { msg -> showFeedback(msg) }
                .onFailure { err -> showFeedback(err.message ?: "Error", isError = true) }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            showFeedback("Sesión cerrada y tokens eliminados del Keystore.")
        }
    }

    fun setThemeMode(mode: ThemeModePreference) {
        viewModelScope.launch {
            repository.setThemeMode(mode)
        }
    }

    fun createAgency(name: String, taxId: String, ownerName: String, ownerEmail: String, phone: String) {
        viewModelScope.launch {
            repository.createAgency(name, taxId, ownerName, ownerEmail, phone)
                .onSuccess { showFeedback("Agencia '${it.name}' creada exitosamente.") }
                .onFailure { showFeedback(it.message ?: "Error al crear agencia", isError = true) }
        }
    }

    fun toggleAgencySuspension(agencyId: String) {
        viewModelScope.launch {
            repository.toggleAgencySuspension(agencyId)
            showFeedback("Estado de la agencia actualizado.")
        }
    }

    fun deleteAgency(agencyId: String) {
        viewModelScope.launch {
            repository.deleteAgency(agencyId)
            showFeedback("Agencia eliminada lógicamente.")
        }
    }

    fun createClient(companyName: String, industry: String, contactName: String, contactEmail: String) {
        viewModelScope.launch {
            repository.createClient(companyName, industry, contactName, contactEmail)
                .onSuccess { showFeedback("Cliente '${it.companyName}' creado bajo tu agencia.") }
                .onFailure { showFeedback(it.message ?: "Error al crear cliente", isError = true) }
        }
    }

    fun deleteClient(clientId: String) {
        viewModelScope.launch {
            repository.deleteClient(clientId)
            showFeedback("Cliente eliminado lógicamente.")
        }
    }

    fun togglePlatformOAuth(clientId: String, platform: SocialPlatform, handle: String) {
        viewModelScope.launch {
            repository.toggleClientPlatformConnection(clientId, platform, handle)
            showFeedback("Conexión OAuth con ${platform.displayName} actualizada (AES-256-GCM).")
        }
    }

    fun createWeeklySchedule(clientId: String, weekStart: String, weekEnd: String, title: String, notes: String) {
        viewModelScope.launch {
            repository.createWeeklySchedule(clientId, weekStart, weekEnd, title, notes)
                .onSuccess { showFeedback("Cronograma '${it.title}' creado y notificado al cliente.") }
                .onFailure { showFeedback(it.message ?: "Error al crear cronograma", isError = true) }
        }
    }

    fun uploadVideoToSchedule(
        clientId: String,
        scheduleId: String,
        title: String,
        description: String,
        hashtagsRaw: String,
        durationSeconds: Int,
        sizeMb: Double,
        dayOfWeek: Int,
        plannedTime: String,
        platforms: List<SocialPlatform>,
        shareToFeed: Boolean,
        allowComments: Boolean,
        allowDuetStitch: Boolean,
        madeForKids: Boolean
    ) {
        viewModelScope.launch {
            _transientState.update { it.copy(isLoading = true, uploadProgress = 0.05f) }
            val tags = hashtagsRaw.split(",", " ")
                .map { it.removePrefix("#").trim() }
                .filter { it.isNotEmpty() }

            repository.uploadAndScheduleVideo(
                clientId = clientId,
                scheduleId = scheduleId,
                title = title,
                description = description,
                hashtags = tags,
                durationSeconds = durationSeconds,
                sizeMb = sizeMb,
                dayOfWeek = dayOfWeek,
                plannedTime = plannedTime,
                platforms = platforms,
                shareToFeed = shareToFeed,
                allowComments = allowComments,
                allowDuetStitch = allowDuetStitch,
                madeForKids = madeForKids,
                onProgress = { progress ->
                    _transientState.update { it.copy(uploadProgress = progress) }
                }
            ).onSuccess { video ->
                _transientState.update { it.copy(uploadProgress = 0f) }
                showFeedback("Video '${video.title}' subido a S3 y enviado a revisión del cliente.")
            }.onFailure { err ->
                _transientState.update { it.copy(uploadProgress = 0f) }
                showFeedback(err.message ?: "Error de validación de video", isError = true)
            }
        }
    }

    fun reviewVideo(videoId: String, decision: ApprovalDecision, notes: String) {
        viewModelScope.launch {
            repository.submitClientReview(videoId, decision, notes)
                .onSuccess { video ->
                    showFeedback("Decisión registrada: ${video.workflowStatus.label}")
                }
                .onFailure { err ->
                    showFeedback(err.message ?: "Error al revisar video", isError = true)
                }
        }
    }

    fun addComment(videoId: String, message: String) {
        viewModelScope.launch {
            repository.addVideoComment(videoId, message)
                .onSuccess { showFeedback("Comentario agregado al video.") }
                .onFailure { showFeedback(it.message ?: "Error", isError = true) }
        }
    }

    fun publishOrScheduleVideo(videoId: String, scheduledForIso: String?) {
        viewModelScope.launch {
            repository.publishOrScheduleApprovedVideo(videoId, scheduledForIso)
                .onSuccess { video ->
                    val action = if (scheduledForIso.isNullOrBlank()) "publicado en las 3 redes" else "programado en cola BullMQ"
                    showFeedback("¡Éxito! '${video.title}' fue $action.")
                }
                .onFailure { err ->
                    showFeedback(err.message ?: "No se puede publicar el video", isError = true)
                }
        }
    }

    fun retryFailedPlatform(videoId: String, platform: SocialPlatform) {
        viewModelScope.launch {
            repository.retryFailedPlatformPublication(videoId, platform)
                .onSuccess { showFeedback("Reintento exitoso en ${platform.displayName}.") }
                .onFailure { showFeedback(it.message ?: "Fallo en reintento", isError = true) }
        }
    }

    fun updateHistoryFilters(
        search: String = _transientState.value.historySearchQuery,
        platform: SocialPlatform? = _transientState.value.historyPlatformFilter,
        status: PublicationStatus? = _transientState.value.historyStatusFilter,
        clientId: String? = _transientState.value.historyClientIdFilter
    ) {
        _transientState.update {
            it.copy(
                historySearchQuery = search,
                historyPlatformFilter = platform,
                historyStatusFilter = status,
                historyClientIdFilter = clientId
            )
        }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            repository.markNotificationRead(id)
        }
    }
}
