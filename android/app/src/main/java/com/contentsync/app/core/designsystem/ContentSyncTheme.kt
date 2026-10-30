package com.contentsync.app.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.contentsync.app.domain.model.PlatformPublicationState
import com.contentsync.app.domain.model.PublicationStatus
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.ThemeModePreference
import com.contentsync.app.domain.model.VideoWorkflowStatus
import kotlin.math.abs

/**
 * Paleta semántica calibrada de Dirección C: "Darkroom Studio & Tri-Sync Conduit".
 * - En modo oscuro usa neutros acromáticos de sala de color (#0B0C0E / #12151B) + Lima Señal (#D4F238).
 * - En modo claro usa Piedra Óptica (#F4F3EF / #FAF9F6) + Tinta Carbón (#141518) y Oliva Técnico (#3E4F00)
 *   para garantizar relación de contraste WCAG AAA sin recurrir a azules/violetas genéricos.
 */
@Immutable
data class StudioPalette(
    val isDark: Boolean,
    val canvas: Color,
    val stage: Color,
    val inspector: Color,
    val elevated: Color,
    val hairline: Color,
    val borderStrong: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val signalAccent: Color,
    val onSignalAccent: Color,
    val signalSubtleBg: Color,
    val signalSubtleText: Color,
    val tallyLive: Color,
    val tallyLiveBg: Color,
    val tallyWarn: Color,
    val tallyWarnBg: Color,
    val tallyFault: Color,
    val tallyFaultBg: Color
)

private val DarkStudioPalette = StudioPalette(
    isDark = true,
    canvas = Color(0xFF0B0C0E),
    stage = Color(0xFF111318),
    inspector = Color(0xFF151820),
    elevated = Color(0xFF1B1F29),
    hairline = Color(0xFF232732),
    borderStrong = Color(0xFF363C4B),
    textPrimary = Color(0xFFF2F3F5),
    textSecondary = Color(0xFF9BA2B0),
    textMuted = Color(0xFF666D7C),
    signalAccent = Color(0xFFD4F238),
    onSignalAccent = Color(0xFF0B0C0E),
    signalSubtleBg = Color(0xFF212610),
    signalSubtleText = Color(0xFFDDF65A),
    tallyLive = Color(0xFF34D399),
    tallyLiveBg = Color(0xFF0A291F),
    tallyWarn = Color(0xFFFBBF24),
    tallyWarnBg = Color(0xFF2B1D07),
    tallyFault = Color(0xFFF87171),
    tallyFaultBg = Color(0xFF2D1114)
)

private val LightStudioPalette = StudioPalette(
    isDark = false,
    canvas = Color(0xFFF4F3EF),
    stage = Color(0xFFFAF9F6),
    inspector = Color(0xFFEEECE6),
    elevated = Color(0xFFE5E2DA),
    hairline = Color(0xFFD6D3C9),
    borderStrong = Color(0xFFACA79B),
    textPrimary = Color(0xFF141518),
    textSecondary = Color(0xFF4D515A),
    textMuted = Color(0xFF747984),
    signalAccent = Color(0xFF141518),
    onSignalAccent = Color(0xFFFAF9F6),
    signalSubtleBg = Color(0xFFE5F296),
    signalSubtleText = Color(0xFF2D3B00),
    tallyLive = Color(0xFF065F46),
    tallyLiveBg = Color(0xFFD1FAE5),
    tallyWarn = Color(0xFF92400E),
    tallyWarnBg = Color(0xFFFEF3C7),
    tallyFault = Color(0xFF991B1B),
    tallyFaultBg = Color(0xFFFEE2E2)
)

val LocalStudioPalette = staticCompositionLocalOf { DarkStudioPalette }

object StudioTheme {
    val colors: StudioPalette
        @Composable get() = LocalStudioPalette.current
}

private val DarkMaterialColors = darkColorScheme(
    primary = Color(0xFFD4F238),
    onPrimary = Color(0xFF0B0C0E),
    primaryContainer = Color(0xFF232910),
    onPrimaryContainer = Color(0xFFE7F982),
    secondary = Color(0xFF34D399),
    onSecondary = Color(0xFF052E16),
    secondaryContainer = Color(0xFF0A291F),
    onSecondaryContainer = Color(0xFFA7F3D0),
    tertiary = Color(0xFFFBBF24),
    background = Color(0xFF0B0C0E),
    onBackground = Color(0xFFF2F3F5),
    surface = Color(0xFF111318),
    onSurface = Color(0xFFF2F3F5),
    surfaceVariant = Color(0xFF181C24),
    onSurfaceVariant = Color(0xFF9BA2B0),
    outline = Color(0xFF2B303D),
    outlineVariant = Color(0xFF20242E),
    error = Color(0xFFF87171),
    onError = Color(0xFF2D0A0D),
    errorContainer = Color(0xFF2D1114),
    onErrorContainer = Color(0xFFFECACA)
)

private val LightMaterialColors = lightColorScheme(
    primary = Color(0xFF141518),
    onPrimary = Color(0xFFFAF9F6),
    primaryContainer = Color(0xFFE5F296),
    onPrimaryContainer = Color(0xFF1E2600),
    secondary = Color(0xFF065F46),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFD1FAE5),
    onSecondaryContainer = Color(0xFF064E3B),
    tertiary = Color(0xFF92400E),
    background = Color(0xFFF4F3EF),
    onBackground = Color(0xFF141518),
    surface = Color(0xFFFAF9F6),
    onSurface = Color(0xFF141518),
    surfaceVariant = Color(0xFFEBE9E2),
    onSurfaceVariant = Color(0xFF4D515A),
    outline = Color(0xFFC4C0B5),
    outlineVariant = Color(0xFFD6D3C9),
    error = Color(0xFFB91C1C),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF7F1D1D)
)

/**
 * Geometría arquitectónica: radios secos (2dp a 4dp), prohibiendo pastillas infladas por inercia.
 */
val StudioShapes = Shapes(
    extraSmall = RoundedCornerShape(2.dp),
    small = RoundedCornerShape(3.dp),
    medium = RoundedCornerShape(4.dp),
    large = RoundedCornerShape(6.dp),
    extraLarge = RoundedCornerShape(8.dp)
)

/**
 * Jerarquía tipográfica reconocible de 3 voces:
 * - Display / Headlines con tracking cerrado (-0.5sp) para cabeceras y marcadores de día.
 * - Body limpia y legible para guiones y descripciones.
 * - Labels en Monospace tabular para códigos de tiempo, tamaños MB, fechas UTC y canales.
 */
val StudioTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.8).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 27.sp,
        letterSpacing = (-0.5).sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 23.sp,
        letterSpacing = (-0.3).sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = (-0.15).sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 17.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.3.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 15.sp,
        letterSpacing = 0.3.sp
    )
)

@Composable
fun ContentSyncTheme(
    themePreference: ThemeModePreference = ThemeModePreference.SYSTEM,
    content: @Composable () -> Unit
) {
    // En modo SYSTEM priorizamos Darkroom como entorno calibrado si el dispositivo está en oscuro;
    // permitimos conmutación inmediata a Papel Óptico Claro o Darkroom Oscuro.
    val useDark = when (themePreference) {
        ThemeModePreference.SYSTEM -> isSystemInDarkTheme()
        ThemeModePreference.LIGHT -> false
        ThemeModePreference.DARK -> true
    }

    val studioPalette = if (useDark) DarkStudioPalette else LightStudioPalette
    val materialColors = if (useDark) DarkMaterialColors else LightMaterialColors

    CompositionLocalProvider(LocalStudioPalette provides studioPalette) {
        MaterialTheme(
            colorScheme = materialColors,
            shapes = StudioShapes,
            typography = StudioTypography,
            content = content
        )
    }
}

/**
 * Símbolo gráfico propio de ContentSync: 3 barras verticales sincronizadas (1 archivo -> 3 canales).
 * Incluye armónico sutil cuando hay actividad de red o ingesta en curso.
 */
@Composable
fun TriSyncBrandMark(
    isActive: Boolean = false,
    modifier: Modifier = Modifier
) {
    val palette = StudioTheme.colors
    val barColor = if (palette.isDark) palette.signalAccent else palette.textPrimary
    val infinite = rememberInfiniteTransition(label = "brandHarmonic")
    val phase by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "brandPhase"
    )
    val h1 = if (isActive) (14f + 4f * phase).dp else 18.dp
    val h2 = if (isActive) (17f - 5f * phase).dp else 12.dp
    val h3 = if (isActive) (12f + 5f * phase).dp else 16.dp

    Row(
        modifier = modifier.height(18.dp),
        horizontalArrangement = Arrangement.spacedBy(2.5.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        Box(modifier = Modifier.width(3.dp).height(h1).background(barColor))
        Box(modifier = Modifier.width(3.dp).height(h2).background(barColor.copy(alpha = 0.72f)))
        Box(modifier = Modifier.width(3.dp).height(h3).background(barColor))
    }
}

/**
 * Indicador Tally de estudio con pulso sinusoidal sutil y no invasivo.
 */
@Composable
fun StudioTallyDot(
    color: Color,
    pulsing: Boolean = true,
    size: Dp = 6.dp,
    modifier: Modifier = Modifier
) {
    val infinite = rememberInfiniteTransition(label = "tallyPulse")
    val alpha by infinite.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "tallyAlpha"
    )
    Box(
        modifier = modifier
            .size(size)
            .background(color.copy(alpha = if (pulsing) alpha else 1f), RoundedCornerShape(1.dp))
    )
}

/**
 * Formatea segundos como código de tiempo tabular MM:SS (ej. 45 -> "00:45", 135 -> "02:15").
 */
fun formatTimecode(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val mins = safe / 60
    val secs = safe % 60
    return "%02d:%02d".format(mins, secs)
}

/**
 * Código corto de canal para telemetría compacta.
 */
val SocialPlatform.shortCode: String
    get() = when (this) {
        SocialPlatform.INSTAGRAM -> "IG"
        SocialPlatform.TIKTOK -> "TT"
        SocialPlatform.YOUTUBE -> "YT"
    }

/**
 * Miniatura cinematográfica 9:16 real con guías de encuadre, scrubbing óptico opcional y código de tiempo.
 */
@Composable
fun VerticalReelFrame(
    title: String,
    durationSeconds: Int,
    width: Dp = 52.dp,
    showSafeGuides: Boolean = false,
    playheadProgress: Float? = null,
    modifier: Modifier = Modifier
) {
    val palette = StudioTheme.colors
    val seed = abs(title.hashCode())
    val cinematicPairs = listOf(
        Color(0xFF2E1E18) to Color(0xFF5D3A29),
        Color(0xFF172722) to Color(0xFF2D5245),
        Color(0xFF262118) to Color(0xFF634D2A),
        Color(0xFF1E222E) to Color(0xFF39445E),
        Color(0xFF2B1922) to Color(0xFF5E2F46)
    )
    val (c1, c2) = cinematicPairs[seed % cinematicPairs.size]
    val safeProgress = playheadProgress?.coerceIn(0f, 1f)
    val displaySeconds = if (safeProgress != null) {
        (durationSeconds * safeProgress).toInt()
    } else {
        durationSeconds
    }

    Box(
        modifier = modifier
            .width(width)
            .aspectRatio(9f / 16f)
            .clip(RoundedCornerShape(3.dp))
            .background(Brush.linearGradient(listOf(c1, c2, Color(0xFF0E1014))))
            .border(1.dp, palette.borderStrong, RoundedCornerShape(3.dp))
    ) {
        if (showSafeGuides || safeProgress != null) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                if (showSafeGuides) {
                    val guideColor = Color.White.copy(alpha = 0.16f)
                    val thirdW = size.width / 3f
                    val thirdH = size.height / 3f
                    drawLine(guideColor, Offset(thirdW, 0f), Offset(thirdW, size.height), strokeWidth = 1f)
                    drawLine(guideColor, Offset(thirdW * 2f, 0f), Offset(thirdW * 2f, size.height), strokeWidth = 1f)
                    drawLine(guideColor, Offset(0f, thirdH), Offset(size.width, thirdH), strokeWidth = 1f)
                    drawLine(guideColor, Offset(0f, thirdH * 2f), Offset(size.width, thirdH * 2f), strokeWidth = 1f)
                }
                if (safeProgress != null) {
                    val x = (size.width * safeProgress).coerceIn(1f, size.width - 1f)
                    drawLine(
                        color = Color(0xFFD4F238).copy(alpha = 0.88f),
                        start = Offset(x, 0f),
                        end = Offset(x, size.height),
                        strokeWidth = 2f
                    )
                }
            }
        }

        // Etiqueta superior 9:16
        Text(
            text = "9:16",
            color = Color(0xFFE5E7EB),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(3.dp)
                .background(Color.Black.copy(alpha = 0.62f), RoundedCornerShape(2.dp))
                .padding(horizontal = 3.dp, vertical = 1.dp)
        )

        // Timecode inferior MM:SS
        Text(
            text = formatTimecode(displaySeconds),
            color = if (safeProgress != null) Color(0xFFD4F238) else Color.White,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(3.dp)
                .background(Color.Black.copy(alpha = 0.76f), RoundedCornerShape(2.dp))
                .padding(horizontal = 4.dp, vertical = 1.dp)
        )
    }
}

/**
 * Barra de scrubbing táctil con estampado rápido de código de tiempo para la Sala de Revisión.
 */
@Composable
fun InteractiveTimelineScrubber(
    durationSeconds: Int,
    progress: Float,
    onProgressChange: (Float) -> Unit,
    onStampTimecode: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val palette = StudioTheme.colors
    val clamped = progress.coerceIn(0f, 1f)
    val currentTimecode = formatTimecode((durationSeconds * clamped).toInt())
    val totalTimecode = formatTimecode(durationSeconds)
    val playheadColor = if (palette.isDark) palette.signalAccent else palette.textPrimary

    Column(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
            .background(palette.stage, RoundedCornerShape(3.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$currentTimecode / $totalTimecode",
                style = MaterialTheme.typography.labelSmall,
                color = palette.signalSubtleText,
                fontWeight = FontWeight.SemiBold
            )
            if (onStampTimecode != null) {
                Surface(
                    color = palette.elevated,
                    shape = RoundedCornerShape(2.dp),
                    border = BorderStroke(1.dp, palette.borderStrong),
                    modifier = Modifier.clickable { onStampTimecode(currentTimecode) }
                ) {
                    Text(
                        text = "+ CITAR [$currentTimecode]",
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textPrimary,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                    )
                }
            }
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(18.dp)
                .pointerInput(durationSeconds) {
                    detectTapGestures { offset ->
                        if (size.width > 0) {
                            onProgressChange((offset.x / size.width.toFloat()).coerceIn(0f, 1f))
                        }
                    }
                }
                .pointerInput(durationSeconds) {
                    detectHorizontalDragGestures { change, _ ->
                        change.consume()
                        if (size.width > 0) {
                            onProgressChange((change.position.x / size.width.toFloat()).coerceIn(0f, 1f))
                        }
                    }
                }
        ) {
            val midY = size.height / 2f
            // Ticks de regla óptica cada 1/12
            val tickCount = 16
            for (i in 0..tickCount) {
                val tx = (size.width / tickCount.toFloat()) * i
                val tickH = if (i % 4 == 0) 10f else 5f
                drawLine(
                    color = palette.borderStrong.copy(alpha = 0.55f),
                    start = Offset(tx, midY - tickH / 2f),
                    end = Offset(tx, midY + tickH / 2f),
                    strokeWidth = 1f
                )
            }
            // Pista base y tramo recorrido
            drawLine(
                color = palette.hairline,
                start = Offset(0f, midY),
                end = Offset(size.width, midY),
                strokeWidth = 2f
            )
            val headX = (size.width * clamped).coerceIn(0f, size.width)
            drawLine(
                color = playheadColor,
                start = Offset(0f, midY),
                end = Offset(headX, midY),
                strokeWidth = 2.5f
            )
            // Cabezal óptico vertical
            drawLine(
                color = playheadColor,
                start = Offset(headX, 1f),
                end = Offset(headX, size.height - 1f),
                strokeWidth = 2.5f
            )
        }
    }
}

/**
 * ELEMENTO VISUAL MEMORABLE: "El Riel Tri-Canal (Tri-Sync Conduit)".
 * Conector gráfico propio (IG ── TT ── YT) con pulso óptico viajero no invasivo
 * que expresa "1 subida S3 -> 3 emisiones independientes".
 */
@Composable
fun TriSyncConduit(
    targetPlatforms: List<SocialPlatform>,
    publications: List<PlatformPublicationState> = emptyList(),
    workflowStatus: VideoWorkflowStatus = VideoWorkflowStatus.DRAFT,
    modifier: Modifier = Modifier
) {
    val palette = StudioTheme.colors
    val hasActiveFlow = targetPlatforms.isNotEmpty() && workflowStatus != VideoWorkflowStatus.DRAFT &&
            workflowStatus != VideoWorkflowStatus.REJECTED

    val infinite = rememberInfiniteTransition(label = "conduitPulse")
    val pulsePos by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wirePacket"
    )
    val faultAlpha by infinite.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "faultTally"
    )

    Row(
        modifier = modifier.semantics {
            contentDescription = "Riel Tri-Canal de sincronización multi-red"
        },
        verticalAlignment = Alignment.CenterVertically
    ) {
        SocialPlatform.entries.forEachIndexed { index, platform ->
            val isTargeted = platform in targetPlatforms
            val pub = publications.find { it.platform == platform }
            val isFault = isTargeted && pub?.status == PublicationStatus.FAILED

            val (rawBorder, rawBg, rawText) = when {
                !isTargeted -> Triple(palette.hairline, Color.Transparent, palette.textMuted)
                isFault -> Triple(
                    palette.tallyFault.copy(alpha = faultAlpha),
                    palette.tallyFaultBg,
                    palette.tallyFault
                )
                pub?.status == PublicationStatus.PUBLISHED ||
                        workflowStatus == VideoWorkflowStatus.PUBLISHED ||
                        workflowStatus == VideoWorkflowStatus.APPROVED ||
                        workflowStatus == VideoWorkflowStatus.SCHEDULED -> Triple(
                    palette.tallyLive,
                    palette.tallyLiveBg,
                    palette.tallyLive
                )
                pub?.status == PublicationStatus.PROCESSING ||
                        workflowStatus == VideoWorkflowStatus.IN_REVIEW -> Triple(
                    palette.tallyWarn,
                    palette.tallyWarnBg,
                    palette.tallyWarn
                )
                else -> Triple(palette.borderStrong, palette.elevated, palette.textPrimary)
            }

            val borderColor by animateColorAsState(rawBorder, animationSpec = tween(220), label = "nodeBorder")
            val bgColor by animateColorAsState(rawBg, animationSpec = tween(220), label = "nodeBg")
            val textColor by animateColorAsState(rawText, animationSpec = tween(220), label = "nodeText")

            Box(
                modifier = Modifier
                    .border(1.dp, borderColor, RoundedCornerShape(2.dp))
                    .background(bgColor, RoundedCornerShape(2.dp))
                    .padding(horizontal = 5.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = platform.shortCode,
                    color = textColor,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = if (isTargeted) FontWeight.Bold else FontWeight.Normal
                )
            }

            if (index < SocialPlatform.entries.lastIndex) {
                val wireSignalColor = if (palette.isDark) palette.signalAccent else palette.tallyLive
                Canvas(
                    modifier = Modifier
                        .width(10.dp)
                        .height(4.dp)
                ) {
                    val cy = size.height / 2f
                    drawLine(
                        color = palette.borderStrong,
                        start = Offset(0f, cy),
                        end = Offset(size.width, cy),
                        strokeWidth = 1.2f
                    )
                    if (hasActiveFlow) {
                        val localPhase = ((pulsePos - index * 0.28f) + 1f) % 1f
                        val px = size.width * localPhase
                        drawCircle(
                            color = wireSignalColor.copy(alpha = 0.85f),
                            radius = 1.6f,
                            center = Offset(px, cy)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Etiqueta de estado óptico con borde arquitectónico de 1dp (sin pastillas redondeadas genéricas).
 */
@Composable
fun WorkflowStatusBadge(status: VideoWorkflowStatus) {
    val palette = StudioTheme.colors
    val (bg, fg, border) = when (status) {
        VideoWorkflowStatus.DRAFT -> Triple(palette.elevated, palette.textSecondary, palette.borderStrong)
        VideoWorkflowStatus.IN_REVIEW -> Triple(palette.signalSubtleBg, palette.signalSubtleText, palette.signalSubtleText.copy(alpha = 0.45f))
        VideoWorkflowStatus.CHANGES_REQUESTED -> Triple(palette.tallyWarnBg, palette.tallyWarn, palette.tallyWarn.copy(alpha = 0.55f))
        VideoWorkflowStatus.REJECTED -> Triple(palette.tallyFaultBg, palette.tallyFault, palette.tallyFault.copy(alpha = 0.55f))
        VideoWorkflowStatus.APPROVED -> Triple(palette.tallyLiveBg, palette.tallyLive, palette.tallyLive.copy(alpha = 0.55f))
        VideoWorkflowStatus.SCHEDULED -> Triple(palette.tallyLiveBg, palette.tallyLive, palette.tallyLive.copy(alpha = 0.55f))
        VideoWorkflowStatus.PUBLISHED -> Triple(palette.tallyLiveBg, palette.tallyLive, palette.tallyLive)
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(2.dp),
        border = BorderStroke(1.dp, border),
        modifier = Modifier.semantics {
            contentDescription = "Estado del flujo: ${status.label}"
        }
    ) {
        Text(
            text = status.label.uppercase(),
            color = fg,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun PlatformChip(platform: SocialPlatform) {
    val palette = StudioTheme.colors
    Surface(
        color = palette.elevated,
        shape = RoundedCornerShape(2.dp),
        border = BorderStroke(1.dp, palette.borderStrong)
    ) {
        Text(
            text = "${platform.shortCode} · ${platform.displayName}",
            color = palette.textPrimary,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun PublicationStatusRow(
    platform: SocialPlatform,
    status: PublicationStatus,
    errorMsg: String?,
    onRetry: (() -> Unit)? = null
) {
    val palette = StudioTheme.colors
    val (indicatorColor, statusLabel) = when (status) {
        PublicationStatus.PUBLISHED -> palette.tallyLive to "EN AIRE"
        PublicationStatus.FAILED -> palette.tallyFault to "FALLO API"
        PublicationStatus.PROCESSING -> palette.tallyWarn to "EN COLA"
        PublicationStatus.PENDING -> palette.textSecondary to "PENDIENTE"
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
            .background(palette.stage, RoundedCornerShape(3.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .background(indicatorColor, RoundedCornerShape(1.dp))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${platform.shortCode} · ${platform.displayName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Medium
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = statusLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = indicatorColor,
                    fontWeight = FontWeight.Bold
                )
                if (status == PublicationStatus.FAILED && onRetry != null) {
                    Text(
                        text = "REINTENTAR →",
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textPrimary,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .border(1.dp, palette.tallyFault, RoundedCornerShape(2.dp))
                            .clickable(onClick = onRetry)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }
        if (!errorMsg.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = errorMsg,
                style = MaterialTheme.typography.labelSmall,
                color = palette.tallyFault,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun StudioSectionHeader(
    eyebrow: String,
    title: String,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null
) {
    val palette = StudioTheme.colors
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = eyebrow.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = palette.textPrimary
                )
            }
            if (trailing != null) {
                Spacer(modifier = Modifier.width(12.dp))
                trailing()
            }
        }
        if (!subtitle.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = palette.textSecondary
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(thickness = 1.dp, color = palette.hairline)
    }
}

/**
 * Estado vacío diseñado con intención editorial y acción clara (reemplaza EmptyStateCard genérico).
 */
@Composable
fun EmptyStateCard(
    title: String,
    subtitle: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    val palette = StudioTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
            .background(palette.stage, RoundedCornerShape(4.dp))
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .background(palette.signalAccent, RoundedCornerShape(1.dp))
            )
            Text(
                text = "TODO AL DÍA",
                style = MaterialTheme.typography.labelSmall,
                color = palette.textMuted
            )
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = palette.textPrimary
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = palette.textSecondary
        )
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Surface(
                color = palette.signalAccent,
                shape = RoundedCornerShape(3.dp),
                modifier = Modifier.clickable(onClick = onAction)
            ) {
                Text(
                    text = actionLabel.uppercase(),
                    color = palette.onSignalAccent,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
        }
    }
}
