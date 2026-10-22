package com.contentsync.app.data.repository

import com.contentsync.app.core.datastore.SecureSessionStorage
import com.contentsync.app.domain.model.*
import com.contentsync.app.domain.repository.ContentSyncRepository
import com.contentsync.app.domain.usecase.ValidateVideoForPlatformsUseCase
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementación del repositorio de ContentSync que sincroniza almacenamiento seguro
 * de tokens (`EncryptedSharedPreferences`), preferencias (`DataStore`), reglas de negocio
 * multi-tenant por rol (`ADMIN_GENERAL`, `AGENCIA`, `CLIENTE`) y datos de semilla idénticos
 * al Backend NestJS.
 */
@Singleton
class ContentSyncRepositoryImpl @Inject constructor(
    private val sessionStorage: SecureSessionStorage,
    private val validator: ValidateVideoForPlatformsUseCase
) : ContentSyncRepository {

    private val _session = MutableStateFlow<UserSession?>(null)
    override val currentSessionFlow: Flow<UserSession?> = _session
    override val themeModeFlow: Flow<ThemeModePreference> = sessionStorage.themeModeFlow

    private val _allAgencies = MutableStateFlow(
        listOf(
            AgencyItem(
                id = "agency-nova",
                name = "Nova Digital Marketing",
                taxId = "30-71548921-9",
                ownerEmail = "agencia.nova@contentsync.io",
                ownerFullName = "Lucas Herrera (Nova Digital)",
                contactPhone = "+54 11 4890-1122",
                isSuspended = false,
                clientsCount = 2
            ),
            AgencyItem(
                id = "agency-pulso",
                name = "Pulso Social Media",
                taxId = "30-79823410-4",
                ownerEmail = "agencia.pulso@contentsync.io",
                ownerFullName = "Camila Gómez (Pulso Social Media)",
                contactPhone = "+52 55 3190-4455",
                isSuspended = false,
                clientsCount = 2
            )
        )
    )

    private val _allClients = MutableStateFlow(
        listOf(
            ClientItem(
                id = "client-kafecito",
                agencyId = "agency-nova",
                agencyName = "Nova Digital Marketing",
                companyName = "Kafecito Roasters S.A.",
                industry = "Gastronomía & Café",
                contactEmail = "cliente.kafecito@contentsync.io",
                contactFullName = "Martín Rossi",
                isActive = true,
                connections = listOf(
                    PlatformConnectionItem(SocialPlatform.INSTAGRAM, "@kafecitoroasters", true),
                    PlatformConnectionItem(SocialPlatform.TIKTOK, "@kafecito.ar", true),
                    PlatformConnectionItem(SocialPlatform.YOUTUBE, "@KafecitoShorts", true)
                )
            ),
            ClientItem(
                id = "client-urbanfit",
                agencyId = "agency-nova",
                agencyName = "Nova Digital Marketing",
                companyName = "UrbanFit Wellness Club",
                industry = "Fitness & Salud",
                contactEmail = "cliente.urbanfit@contentsync.io",
                contactFullName = "Valentina Paz",
                isActive = true,
                connections = listOf(
                    PlatformConnectionItem(SocialPlatform.INSTAGRAM, "@urbanfitclub", true),
                    PlatformConnectionItem(SocialPlatform.TIKTOK, "@urbanfit.gym", true),
                    PlatformConnectionItem(SocialPlatform.YOUTUBE, "@UrbanFitTV", false)
                )
            ),
            ClientItem(
                id = "client-techgear",
                agencyId = "agency-pulso",
                agencyName = "Pulso Social Media",
                companyName = "TechGear Latam",
                industry = "E-Commerce & Tecnología",
                contactEmail = "cliente.techgear@contentsync.io",
                contactFullName = "Diego Vega",
                isActive = true,
                connections = listOf(
                    PlatformConnectionItem(SocialPlatform.INSTAGRAM, "@techgearlatam", true),
                    PlatformConnectionItem(SocialPlatform.TIKTOK, "@techgear.oficial", true),
                    PlatformConnectionItem(SocialPlatform.YOUTUBE, "@TechGearReviews", true)
                )
            ),
            ClientItem(
                id = "client-lumina",
                agencyId = "agency-pulso",
                agencyName = "Pulso Social Media",
                companyName = "Lumina Diseño Interior",
                industry = "Hogar & Decoración",
                contactEmail = "cliente.lumina@contentsync.io",
                contactFullName = "Elena Silva",
                isActive = true,
                connections = listOf(
                    PlatformConnectionItem(SocialPlatform.INSTAGRAM, "@luminadeco", true),
                    PlatformConnectionItem(SocialPlatform.TIKTOK, "@luminainterior", false),
                    PlatformConnectionItem(SocialPlatform.YOUTUBE, "@LuminaHome", true)
                )
            )
        )
    )

    private val _allVideos = MutableStateFlow(
        listOf(
            VideoItem(
                id = "vid-coldbrew",
                clientId = "client-kafecito",
                clientName = "Kafecito Roasters S.A.",
                title = "Receta Cold Brew en 45 segundos",
                description = "Descubre cómo preparamos nuestro Cold Brew infusionado durante 18 horas.",
                hashtags = listOf("coldbrew", "cafedeespecialidad", "barista"),
                durationSeconds = 45,
                sizeMb = 28.5,
                workflowStatus = VideoWorkflowStatus.IN_REVIEW,
                targetPlatforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE),
                shareToFeed = true,
                allowComments = true,
                allowDuetStitch = true,
                madeForKids = false,
                dayOfWeek = 3,
                plannedPublishAt = "2026-10-23 18:00",
                comments = listOf(
                    VideoCommentItem(
                        id = "c-1",
                        authorName = "Lucas Herrera (Nova Digital)",
                        message = "Subido con corrección de color y subtítulos dinámicos.",
                        createdAt = "Hace 2 h"
                    )
                ),
                publications = emptyList()
            ),
            VideoItem(
                id = "vid-latteart",
                clientId = "client-kafecito",
                clientName = "Kafecito Roasters S.A.",
                title = "3 Secretos del Latte Art Perfecto",
                description = "Texturización de leche a 62°C para lograr microespuma brillante.",
                hashtags = listOf("latteart", "espresso", "cafeteria"),
                durationSeconds = 38,
                sizeMb = 22.1,
                workflowStatus = VideoWorkflowStatus.APPROVED,
                targetPlatforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE),
                shareToFeed = true,
                allowComments = true,
                allowDuetStitch = true,
                madeForKids = false,
                dayOfWeek = 5,
                plannedPublishAt = "2026-10-24 19:30",
                comments = listOf(
                    VideoCommentItem(
                        id = "c-2",
                        authorName = "Martín Rossi (Cliente)",
                        message = "[APPROVED] ¡Excelente toma de la taza! Listo para publicar.",
                        createdAt = "Hace 1 h"
                    )
                ),
                publications = emptyList()
            ),
            VideoItem(
                id = "vid-roasting-history",
                clientId = "client-kafecito",
                clientName = "Kafecito Roasters S.A.",
                title = "Tueste artesanal de granos colombianos",
                description = "Así logramos el perfil achocolatado en nuestro lote Huila.",
                hashtags = listOf("tuestedecafe", "colombiancoffee"),
                durationSeconds = 52,
                sizeMb = 34.1,
                workflowStatus = VideoWorkflowStatus.PUBLISHED,
                targetPlatforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE),
                shareToFeed = true,
                allowComments = true,
                allowDuetStitch = true,
                madeForKids = false,
                dayOfWeek = 4,
                plannedPublishAt = "2026-10-15 15:00",
                comments = emptyList(),
                publications = listOf(
                    PlatformPublicationState(
                        platform = SocialPlatform.INSTAGRAM,
                        status = PublicationStatus.PUBLISHED,
                        scheduledFor = "2026-10-15 15:00",
                        publishedAt = "2026-10-15 15:00:12",
                        externalPostUrl = "https://www.instagram.com/reel/CxyzDemo1/",
                        lastErrorMessage = null,
                        attemptsCount = 1
                    ),
                    PlatformPublicationState(
                        platform = SocialPlatform.TIKTOK,
                        status = PublicationStatus.PUBLISHED,
                        scheduledFor = "2026-10-15 15:00",
                        publishedAt = "2026-10-15 15:00:15",
                        externalPostUrl = "https://www.tiktok.com/@kafecito/video/7741290",
                        lastErrorMessage = null,
                        attemptsCount = 1
                    ),
                    PlatformPublicationState(
                        platform = SocialPlatform.YOUTUBE,
                        status = PublicationStatus.PUBLISHED,
                        scheduledFor = "2026-10-15 15:00",
                        publishedAt = "2026-10-15 15:00:19",
                        externalPostUrl = "https://youtube.com/shorts/AbCdEf123",
                        lastErrorMessage = null,
                        attemptsCount = 1
                    )
                )
            ),
            VideoItem(
                id = "vid-hiit-urban",
                clientId = "client-urbanfit",
                clientName = "UrbanFit Wellness Club",
                title = "Rutina HIIT Quema Grasa en 20 Minutos",
                description = "Entrenamiento funcional sin impacto guiado por nuestros coaches.",
                hashtags = listOf("hiit", "fitness", "gymmotivation"),
                durationSeconds = 58,
                sizeMb = 41.0,
                workflowStatus = VideoWorkflowStatus.CHANGES_REQUESTED,
                targetPlatforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK),
                shareToFeed = true,
                allowComments = true,
                allowDuetStitch = false,
                madeForKids = false,
                dayOfWeek = 2,
                plannedPublishAt = "2026-10-22 10:00",
                comments = listOf(
                    VideoCommentItem(
                        id = "c-3",
                        authorName = "Valentina Paz (Cliente)",
                        message = "[CHANGES_REQUESTED] Por favor agregar el logo de la sede Palermo al final.",
                        createdAt = "Hace 30 min"
                    )
                ),
                publications = emptyList()
            ),
            VideoItem(
                id = "vid-techgear-unbox",
                clientId = "client-techgear",
                clientName = "TechGear Latam",
                title = "Unboxing Teclado Mecánico Magnético",
                description = "Switches Hall Effect con actuación ajustable de 0.1mm.",
                hashtags = listOf("gaming", "tecladomecanico", "setup"),
                durationSeconds = 49,
                sizeMb = 31.8,
                workflowStatus = VideoWorkflowStatus.PUBLISHED,
                targetPlatforms = listOf(SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE),
                shareToFeed = true,
                allowComments = true,
                allowDuetStitch = true,
                madeForKids = false,
                dayOfWeek = 1,
                plannedPublishAt = "2026-10-14 20:00",
                comments = emptyList(),
                publications = listOf(
                    PlatformPublicationState(
                        platform = SocialPlatform.INSTAGRAM,
                        status = PublicationStatus.PUBLISHED,
                        scheduledFor = "2026-10-14 20:00",
                        publishedAt = "2026-10-14 20:00:08",
                        externalPostUrl = "https://www.instagram.com/reel/TechGear99/",
                        lastErrorMessage = null,
                        attemptsCount = 1
                    ),
                    PlatformPublicationState(
                        platform = SocialPlatform.TIKTOK,
                        status = PublicationStatus.FAILED,
                        scheduledFor = "2026-10-14 20:00",
                        publishedAt = null,
                        externalPostUrl = null,
                        lastErrorMessage = "TikTok API Rate Limit Exceeded (HTTP 429) tras 3 reintentos.",
                        attemptsCount = 3
                    ),
                    PlatformPublicationState(
                        platform = SocialPlatform.YOUTUBE,
                        status = PublicationStatus.PUBLISHED,
                        scheduledFor = "2026-10-14 20:00",
                        publishedAt = "2026-10-14 20:00:22",
                        externalPostUrl = "https://youtube.com/shorts/TGKey99",
                        lastErrorMessage = null,
                        attemptsCount = 1
                    )
                )
            )
        )
    )

    private val _allSchedules = MutableStateFlow(
        listOf(
            WeeklyScheduleItem(
                id = "sched-kafecito-w43",
                clientId = "client-kafecito",
                clientName = "Kafecito Roasters S.A.",
                weekStartDate = "2026-10-19",
                weekEndDate = "2026-10-25",
                title = "Semana Lanzamiento Cold Brew Primavera",
                summaryNotes = "Reels y Shorts enfocados en bebidas frías y arte latte.",
                videos = emptyList()
            ),
            WeeklyScheduleItem(
                id = "sched-urbanfit-w43",
                clientId = "client-urbanfit",
                clientName = "UrbanFit Wellness Club",
                weekStartDate = "2026-10-19",
                weekEndDate = "2026-10-25",
                title = "Semana Entrenamiento Funcional Primavera",
                summaryNotes = "Rutinas cortas de alta intensidad.",
                videos = emptyList()
            )
        )
    )

    private val _notifications = MutableStateFlow(
        listOf(
            NotificationItem(
                id = "notif-1",
                title = "Video Aprobado por Cliente",
                body = "Martín Rossi aprobó '3 Secretos del Latte Art Perfecto'. Ya puedes publicarlo.",
                createdAt = "Hace 1 h",
                isRead = false
            ),
            NotificationItem(
                id = "notif-2",
                title = "Cambios Solicitados",
                body = "Valentina Paz pidió cambios en 'Rutina HIIT Quema Grasa en 20 Minutos'.",
                createdAt = "Hace 30 min",
                isRead = false
            ),
            NotificationItem(
                id = "notif-3",
                title = "Publicación Exitosa Multiplataforma",
                body = "'Tueste artesanal de granos colombianos' se publicó en Instagram, TikTok y YouTube.",
                createdAt = "Ayer",
                isRead = true
            )
        )
    )

    override val agenciesFlow: Flow<List<AgencyItem>> = _allAgencies

    // Filtrado estricto en cliente espejando los Guards del Backend:
    // AGENCIA solo ve sus propios clientes; CLIENTE solo ve su propio perfil.
    override val clientsFlow: Flow<List<ClientItem>> = combine(_allClients, _session) { clients, session ->
        when (session?.role) {
            UserRole.ADMIN_GENERAL -> clients
            UserRole.AGENCIA -> clients.filter { it.agencyId == session.agencyId }
            UserRole.CLIENTE -> clients.filter { it.id == session.clientId }
            null -> emptyList()
        }
    }

    override val videosFlow: Flow<List<VideoItem>> = combine(_allVideos, _allClients, _session) { videos, clients, session ->
        val visibleClientIds = when (session?.role) {
            UserRole.ADMIN_GENERAL -> clients.map { it.id }.toSet()
            UserRole.AGENCIA -> clients.filter { it.agencyId == session.agencyId }.map { it.id }.toSet()
            UserRole.CLIENTE -> setOfNotNull(session.clientId)
            null -> emptySet()
        }
        videos.filter { it.clientId in visibleClientIds }
    }

    override val schedulesFlow: Flow<List<WeeklyScheduleItem>> = combine(_allSchedules, videosFlow) { schedules, visibleVideos ->
        val visibleClientIds = visibleVideos.map { it.clientId }.toSet()
        schedules
            .filter { it.clientId in visibleClientIds || visibleVideos.isNotEmpty() }
            .map { sched ->
                sched.copy(videos = visibleVideos.filter { it.clientId == sched.clientId })
            }
            .filter { it.videos.isNotEmpty() || _session.value?.role != UserRole.CLIENTE }
    }

    override val notificationsFlow: Flow<List<NotificationItem>> = _notifications

    override suspend fun loginWithEmail(email: String, password: String): Result<UserSession> {
        val cleanEmail = email.trim().lowercase()
        if (password.length < 6) {
            return Result.failure(IllegalArgumentException("Contraseña inválida."))
        }

        val session = when {
            cleanEmail.contains("admin") -> UserSession(
                id = "usr-admin-1",
                email = cleanEmail,
                fullName = "Sofía Martínez (Admin General)",
                role = UserRole.ADMIN_GENERAL,
                timezone = "America/Argentina/Buenos_Aires",
                emailVerified = true,
                agencyId = null,
                clientId = null
            )
            cleanEmail.contains("pulso") -> UserSession(
                id = "usr-agency-pulso",
                email = cleanEmail,
                fullName = "Camila Gómez (Pulso Social Media)",
                role = UserRole.AGENCIA,
                timezone = "America/Mexico_City",
                emailVerified = true,
                agencyId = "agency-pulso",
                clientId = null
            )
            cleanEmail.contains("cliente") || cleanEmail.contains("kafecito") -> UserSession(
                id = "usr-client-kafecito",
                email = cleanEmail,
                fullName = "Martín Rossi (Kafecito Roasters)",
                role = UserRole.CLIENTE,
                timezone = "America/Argentina/Buenos_Aires",
                emailVerified = true,
                agencyId = "agency-nova",
                clientId = "client-kafecito"
            )
            else -> UserSession(
                id = "usr-agency-nova",
                email = cleanEmail,
                fullName = "Lucas Herrera (Nova Digital)",
                role = UserRole.AGENCIA,
                timezone = "America/Argentina/Buenos_Aires",
                emailVerified = true,
                agencyId = "agency-nova",
                clientId = null
            )
        }

        sessionStorage.saveTokens(
            accessToken = "jwt_access_${session.id}_${System.currentTimeMillis()}",
            refreshToken = "jwt_refresh_${session.id}_${System.currentTimeMillis()}",
            expiresAtEpochMs = System.currentTimeMillis() + 900_000L
        )
        _session.value = session
        return Result.success(session)
    }

    override suspend fun registerAccount(
        fullName: String,
        email: String,
        password: String,
        role: UserRole
    ): Result<UserSession> {
        validator.validatePasswordStrength(password).onFailure { return Result.failure(it) }
        val session = UserSession(
            id = "usr-${System.currentTimeMillis()}",
            email = email.trim().lowercase(),
            fullName = fullName.trim(),
            role = role,
            timezone = "America/Argentina/Buenos_Aires",
            emailVerified = false,
            agencyId = if (role == UserRole.AGENCIA) "agency-nova" else null,
            clientId = if (role == UserRole.CLIENTE) "client-kafecito" else null
        )
        sessionStorage.saveTokens(
            accessToken = "jwt_access_${session.id}",
            refreshToken = "jwt_refresh_${session.id}",
            expiresAtEpochMs = System.currentTimeMillis() + 900_000L
        )
        _session.value = session
        return Result.success(session)
    }

    override suspend fun loginWithSocial(
        provider: SocialAuthProvider,
        email: String,
        fullName: String
    ): Result<UserSession> {
        // Vinculación automática por email para evitar duplicados
        return loginWithEmail(email, "ContentSync2026!")
    }

    override suspend fun requestPasswordRecovery(email: String): Result<String> {
        if (!email.contains("@")) {
            return Result.failure(IllegalArgumentException("Ingresa un correo electrónico válido."))
        }
        return Result.success("Se envió un enlace de recuperación a $email.")
    }

    override suspend fun logout() {
        sessionStorage.clearTokens()
        _session.value = null
    }

    override suspend fun setThemeMode(mode: ThemeModePreference) {
        sessionStorage.setThemeMode(mode)
    }

    override suspend fun createAgency(
        name: String,
        taxId: String,
        ownerName: String,
        ownerEmail: String,
        phone: String
    ): Result<AgencyItem> {
        val newAgency = AgencyItem(
            id = "agency-${System.currentTimeMillis()}",
            name = name.trim(),
            taxId = taxId.trim(),
            ownerEmail = ownerEmail.trim().lowercase(),
            ownerFullName = ownerName.trim(),
            contactPhone = phone.trim(),
            isSuspended = false,
            clientsCount = 0
        )
        _allAgencies.value = listOf(newAgency) + _allAgencies.value
        return Result.success(newAgency)
    }

    override suspend fun toggleAgencySuspension(agencyId: String): Result<Unit> {
        _allAgencies.value = _allAgencies.value.map {
            if (it.id == agencyId) it.copy(isSuspended = !it.isSuspended) else it
        }
        return Result.success(Unit)
    }

    override suspend fun deleteAgency(agencyId: String): Result<Unit> {
        _allAgencies.value = _allAgencies.value.filterNot { it.id == agencyId }
        return Result.success(Unit)
    }

    override suspend fun createClient(
        companyName: String,
        industry: String,
        contactName: String,
        contactEmail: String
    ): Result<ClientItem> {
        val activeSession = _session.value ?: return Result.failure(IllegalStateException("Sesión requerida"))
        val agencyId = activeSession.agencyId ?: "agency-nova"
        val agencyName = _allAgencies.value.find { it.id == agencyId }?.name ?: "Nova Digital Marketing"

        val newClient = ClientItem(
            id = "client-${System.currentTimeMillis()}",
            agencyId = agencyId,
            agencyName = agencyName,
            companyName = companyName.trim(),
            industry = industry.trim(),
            contactEmail = contactEmail.trim().lowercase(),
            contactFullName = contactName.trim(),
            isActive = true,
            connections = SocialPlatform.entries.map {
                PlatformConnectionItem(
                    platform = it,
                    accountHandle = "@${companyName.lowercase().replace(" ", "")}",
                    isConnected = true
                )
            }
        )
        _allClients.value = listOf(newClient) + _allClients.value
        return Result.success(newClient)
    }

    override suspend fun deleteClient(clientId: String): Result<Unit> {
        _allClients.value = _allClients.value.filterNot { it.id == clientId }
        return Result.success(Unit)
    }

    override suspend fun toggleClientPlatformConnection(
        clientId: String,
        platform: SocialPlatform,
        handle: String
    ): Result<Unit> {
        _allClients.value = _allClients.value.map { client ->
            if (client.id != clientId) client
            else client.copy(
                connections = client.connections.map { conn ->
                    if (conn.platform == platform) {
                        conn.copy(isConnected = !conn.isConnected, accountHandle = handle.ifBlank { conn.accountHandle })
                    } else conn
                }
            )
        }
        return Result.success(Unit)
    }

    override suspend fun createWeeklySchedule(
        clientId: String,
        weekStart: String,
        weekEnd: String,
        title: String,
        notes: String
    ): Result<WeeklyScheduleItem> {
        val client = _allClients.value.find { it.id == clientId }
            ?: return Result.failure(IllegalArgumentException("Cliente no encontrado"))
        val sched = WeeklyScheduleItem(
            id = "sched-${System.currentTimeMillis()}",
            clientId = clientId,
            clientName = client.companyName,
            weekStartDate = weekStart,
            weekEndDate = weekEnd,
            title = title.trim(),
            summaryNotes = notes.trim(),
            videos = emptyList()
        )
        _allSchedules.value = listOf(sched) + _allSchedules.value
        pushLocalNotification(
            title = "Nuevo cronograma creado",
            body = "Se creó '${sched.title}' para ${client.companyName}."
        )
        return Result.success(sched)
    }

    override suspend fun uploadAndScheduleVideo(
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
    ): Result<VideoItem> {
        validator.validateVideoSpecs(
            durationSeconds = durationSeconds,
            sizeMb = sizeMb,
            mimeType = "video/mp4",
            platforms = platforms
        ).onFailure { return Result.failure(it) }

        val client = _allClients.value.find { it.id == clientId }
            ?: return Result.failure(IllegalArgumentException("Cliente inválido"))

        // Simular subida reanudable con reporte de progreso hacia URL prefirmada S3
        val steps = listOf(0.15f, 0.35f, 0.60f, 0.85f, 1.0f)
        for (p in steps) {
            delay(90L)
            onProgress(p)
        }

        val video = VideoItem(
            id = "vid-${System.currentTimeMillis()}",
            clientId = clientId,
            clientName = client.companyName,
            title = title.trim(),
            description = description.trim(),
            hashtags = hashtags,
            durationSeconds = durationSeconds,
            sizeMb = sizeMb,
            workflowStatus = VideoWorkflowStatus.IN_REVIEW,
            targetPlatforms = platforms,
            shareToFeed = shareToFeed,
            allowComments = allowComments,
            allowDuetStitch = allowDuetStitch,
            madeForKids = madeForKids,
            dayOfWeek = dayOfWeek,
            plannedPublishAt = plannedTime,
            comments = listOf(
                VideoCommentItem(
                    id = "c-${System.currentTimeMillis()}",
                    authorName = _session.value?.fullName ?: "Agencia",
                    message = "Video subido y enviado a revisión del cliente.",
                    createdAt = "Ahora"
                )
            ),
            publications = emptyList()
        )
        _allVideos.value = listOf(video) + _allVideos.value
        pushLocalNotification(
            title = "Video en Revisión",
            body = "'${video.title}' está listo para aprobación de ${client.companyName}."
        )
        return Result.success(video)
    }

    override suspend fun submitClientReview(
        videoId: String,
        decision: ApprovalDecision,
        feedbackNotes: String
    ): Result<VideoItem> {
        validator.validateClientReviewInput(decision, feedbackNotes).onFailure {
            return Result.failure(it)
        }

        val targetStatus = when (decision) {
            ApprovalDecision.APPROVED -> VideoWorkflowStatus.APPROVED
            ApprovalDecision.CHANGES_REQUESTED -> VideoWorkflowStatus.CHANGES_REQUESTED
            ApprovalDecision.REJECTED -> VideoWorkflowStatus.REJECTED
        }

        var updatedItem: VideoItem? = null
        val reviewerName = _session.value?.fullName ?: "Cliente"

        _allVideos.value = _allVideos.value.map { video ->
            if (video.id != videoId) video
            else {
                val newComment = VideoCommentItem(
                    id = "rev-${System.currentTimeMillis()}",
                    authorName = reviewerName,
                    message = "[${decision.label.uppercase()}] ${feedbackNotes.ifBlank { "Aprobado sin observaciones." }}",
                    createdAt = "Ahora"
                )
                val copy = video.copy(
                    workflowStatus = targetStatus,
                    comments = video.comments + newComment
                )
                updatedItem = copy
                copy
            }
        }

        val result = updatedItem ?: return Result.failure(IllegalArgumentException("Video no encontrado"))
        pushLocalNotification(
            title = "Revisión de Cliente: ${decision.label}",
            body = "${result.clientName} marcó '${result.title}' como ${targetStatus.label}."
        )
        return Result.success(result)
    }

    override suspend fun addVideoComment(videoId: String, message: String): Result<Unit> {
        if (message.isBlank()) return Result.failure(IllegalArgumentException("El comentario no puede estar vacío"))
        val author = _session.value?.fullName ?: "Usuario"
        _allVideos.value = _allVideos.value.map { video ->
            if (video.id != videoId) video
            else video.copy(
                comments = video.comments + VideoCommentItem(
                    id = "msg-${System.currentTimeMillis()}",
                    authorName = author,
                    message = message.trim(),
                    createdAt = "Ahora"
                )
            )
        }
        return Result.success(Unit)
    }

    override suspend fun publishOrScheduleApprovedVideo(
        videoId: String,
        scheduledForIso: String?
    ): Result<VideoItem> {
        val currentVideo = _allVideos.value.find { it.id == videoId }
            ?: return Result.failure(IllegalArgumentException("Video no encontrado"))

        validator.canPublishVideo(currentVideo).onFailure { return Result.failure(it) }

        val isScheduledFuture = !scheduledForIso.isNullOrBlank()
        val nowStr = "2026-10-22 15:30"
        val pubs = currentVideo.targetPlatforms.map { platform ->
            PlatformPublicationState(
                platform = platform,
                status = if (isScheduledFuture) PublicationStatus.PENDING else PublicationStatus.PUBLISHED,
                scheduledFor = scheduledForIso ?: nowStr,
                publishedAt = if (isScheduledFuture) null else nowStr,
                externalPostUrl = if (isScheduledFuture) null else "https://${platform.name.lowercase()}.com/post/${currentVideo.id}",
                lastErrorMessage = null,
                attemptsCount = if (isScheduledFuture) 0 else 1
            )
        }

        val updated = currentVideo.copy(
            workflowStatus = if (isScheduledFuture) VideoWorkflowStatus.SCHEDULED else VideoWorkflowStatus.PUBLISHED,
            publications = pubs
        )

        _allVideos.value = _allVideos.value.map { if (it.id == videoId) updated else it }
        pushLocalNotification(
            title = if (isScheduledFuture) "Publicación Programada (BullMQ)" else "Publicado en ${pubs.size} Plataformas",
            body = "'${updated.title}' -> ${updated.targetPlatforms.joinToString { it.displayName }}"
        )
        return Result.success(updated)
    }

    override suspend fun retryFailedPlatformPublication(
        videoId: String,
        platform: SocialPlatform
    ): Result<VideoItem> {
        var updatedVideo: VideoItem? = null
        _allVideos.value = _allVideos.value.map { video ->
            if (video.id != videoId) video
            else {
                val newPubs = video.publications.map { pub ->
                    if (pub.platform == platform) {
                        pub.copy(
                            status = PublicationStatus.PUBLISHED,
                            publishedAt = "2026-10-22 15:35",
                            externalPostUrl = "https://${platform.name.lowercase()}.com/post/retried_${video.id}",
                            lastErrorMessage = null,
                            attemptsCount = pub.attemptsCount + 1
                        )
                    } else pub
                }
                val allPublished = newPubs.all { it.status == PublicationStatus.PUBLISHED }
                val copy = video.copy(
                    workflowStatus = if (allPublished) VideoWorkflowStatus.PUBLISHED else video.workflowStatus,
                    publications = newPubs
                )
                updatedVideo = copy
                copy
            }
        }
        return updatedVideo?.let { Result.success(it) }
            ?: Result.failure(IllegalArgumentException("Video no encontrado"))
    }

    override suspend fun markNotificationRead(notificationId: String) {
        _notifications.value = _notifications.value.map {
            if (it.id == notificationId) it.copy(isRead = true) else it
        }
    }

    private fun pushLocalNotification(title: String, body: String) {
        val item = NotificationItem(
            id = "notif-${System.currentTimeMillis()}",
            title = title,
            body = body,
            createdAt = "Ahora",
            isRead = false
        )
        _notifications.value = listOf(item) + _notifications.value
    }
}
