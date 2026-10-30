package com.contentsync.app.presentation.users

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
import com.contentsync.app.core.designsystem.StudioSectionHeader
import com.contentsync.app.core.designsystem.StudioTheme
import com.contentsync.app.core.designsystem.shortCode
import com.contentsync.app.domain.model.SocialPlatform
import com.contentsync.app.domain.model.UserRole
import com.contentsync.app.presentation.ContentSyncUiState
import com.contentsync.app.presentation.MainViewModel

@Composable
fun UsersAndAgenciesScreen(
    uiState: ContentSyncUiState,
    viewModel: MainViewModel
) {
    val role = uiState.session?.role ?: return
    val palette = StudioTheme.colors

    var showCreateAgencyForm by remember { mutableStateOf(false) }
    var showCreateClientForm by remember { mutableStateOf(false) }

    var agencyName by remember { mutableStateOf("") }
    var agencyTaxId by remember { mutableStateOf("") }
    var agencyOwnerName by remember { mutableStateOf("") }
    var agencyOwnerEmail by remember { mutableStateOf("") }
    var agencyPhone by remember { mutableStateOf("") }

    var clientCompany by remember { mutableStateOf("") }
    var clientIndustry by remember { mutableStateOf("") }
    var clientContactName by remember { mutableStateOf("") }
    var clientContactEmail by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // GOBIERNO MULTI-TENANT DE AGENCIAS (EXCLUSIVO ADMIN_GENERAL)
        if (role == UserRole.ADMIN_GENERAL) {
            item {
                StudioSectionHeader(
                    eyebrow = "GOBIERNO MULTI-TENANT · ADMIN GENERAL",
                    title = "Registro de Agencias",
                    subtitle = "Gestioná las agencias, su CUIT y si están activas.",
                    trailing = {
                        Surface(
                            color = palette.signalAccent,
                            shape = RoundedCornerShape(3.dp),
                            modifier = Modifier.clickable { showCreateAgencyForm = !showCreateAgencyForm }
                        ) {
                            Text(
                                text = if (showCreateAgencyForm) "CERRAR" else "+ ALTA AGENCIA",
                                style = MaterialTheme.typography.labelMedium,
                                color = palette.onSignalAccent,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                )
            }

            if (showCreateAgencyForm) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, palette.borderStrong, RoundedCornerShape(4.dp))
                            .background(palette.stage, RoundedCornerShape(4.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "NUEVA AGENCIA",
                            style = MaterialTheme.typography.labelLarge,
                            color = palette.textPrimary
                        )
                        OutlinedTextField(
                            value = agencyName,
                            onValueChange = { agencyName = it },
                            label = { Text("Razón social / Estudio") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = agencyTaxId,
                            onValueChange = { agencyTaxId = it },
                            label = { Text("CUIT") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = agencyOwnerName,
                            onValueChange = { agencyOwnerName = it },
                            label = { Text("Director responsable") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = agencyOwnerEmail,
                            onValueChange = { agencyOwnerEmail = it },
                            label = { Text("Correo corporativo") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Button(
                            onClick = {
                                if (agencyName.isNotBlank() && agencyTaxId.isNotBlank()) {
                                    viewModel.createAgency(
                                        agencyName,
                                        agencyTaxId,
                                        agencyOwnerName,
                                        agencyOwnerEmail,
                                        agencyPhone
                                    )
                                    agencyName = ""
                                    agencyTaxId = ""
                                    showCreateAgencyForm = false
                                }
                            },
                            shape = RoundedCornerShape(3.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.signalAccent,
                                contentColor = palette.onSignalAccent
                            )
                        ) {
                            Text("CREAR AGENCIA", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            items(uiState.agencies, key = { "ag-${it.id}" }) { agency ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, palette.hairline, RoundedCornerShape(3.dp))
                        .background(palette.stage, RoundedCornerShape(3.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = agency.name,
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.textPrimary
                        )
                        Text(
                            text = "CUIT ${agency.taxId} · ${agency.ownerEmail}",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textMuted
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val statusColor = if (agency.isSuspended) palette.tallyFault else palette.tallyLive
                        val statusBg = if (agency.isSuspended) palette.tallyFaultBg else palette.tallyLiveBg
                        Surface(
                            color = statusBg,
                            shape = RoundedCornerShape(2.dp),
                            border = BorderStroke(1.dp, statusColor),
                            modifier = Modifier.clickable { viewModel.toggleAgencySuspension(agency.id) }
                        ) {
                            Text(
                                text = if (agency.isSuspended) "SUSPENDIDA · REACTIVAR" else "ACTIVA · SUSPENDER",
                                style = MaterialTheme.typography.labelSmall,
                                color = statusColor,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        IconButton(onClick = { viewModel.deleteAgency(agency.id) }) {
                            Icon(
                                imageVector = Icons.Outlined.DeleteOutline,
                                contentDescription = "Baja lógica de agencia",
                                tint = palette.textMuted
                            )
                        }
                    }
                }
            }
        }

        // PATCHBAY DE CUENTAS CLIENTE & CONEXIONES OAUTH AES-256-GCM
        item {
            Spacer(modifier = Modifier.height(4.dp))
            StudioSectionHeader(
                eyebrow = "CUENTAS DE MARCA",
                title = if (role == UserRole.AGENCIA) "Tus clientes y redes" else "Cuentas conectadas",
                subtitle = "Cada marca mantiene sus propios tokens cifrados para Instagram Reels, TikTok y YouTube Shorts.",
                trailing = if (role != UserRole.CLIENTE) {
                    {
                        Surface(
                            color = palette.elevated,
                            shape = RoundedCornerShape(3.dp),
                            border = BorderStroke(1.dp, palette.borderStrong),
                            modifier = Modifier.clickable { showCreateClientForm = !showCreateClientForm }
                        ) {
                            Text(
                                text = if (showCreateClientForm) "CERRAR" else "+ NUEVO CLIENTE",
                                style = MaterialTheme.typography.labelMedium,
                                color = palette.textPrimary,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                } else null
            )
        }

        if (showCreateClientForm && role != UserRole.CLIENTE) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, palette.borderStrong, RoundedCornerShape(4.dp))
                        .background(palette.stage, RoundedCornerShape(4.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "AGREGAR CLIENTE",
                        style = MaterialTheme.typography.labelLarge,
                        color = palette.textPrimary
                    )
                    OutlinedTextField(
                        value = clientCompany,
                        onValueChange = { clientCompany = it },
                        label = { Text("Marca / Razón comercial") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = clientIndustry,
                        onValueChange = { clientIndustry = it },
                        label = { Text("Vertical / Industria") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = clientContactName,
                        onValueChange = { clientContactName = it },
                        label = { Text("Responsable de visado") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = clientContactEmail,
                        onValueChange = { clientContactEmail = it },
                        label = { Text("Email de acceso para aprobación") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Button(
                        onClick = {
                            if (clientCompany.isNotBlank() && clientContactEmail.isNotBlank()) {
                                viewModel.createClient(
                                    clientCompany,
                                    clientIndustry,
                                    clientContactName,
                                    clientContactEmail
                                )
                                clientCompany = ""
                                clientIndustry = ""
                                clientContactName = ""
                                clientContactEmail = ""
                                showCreateClientForm = false
                            }
                        },
                        shape = RoundedCornerShape(3.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = palette.signalAccent,
                            contentColor = palette.onSignalAccent
                        )
                    ) {
                        Text("CREAR CUENTA DE MARCA", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }

        if (uiState.clients.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "Sin marcas vinculadas",
                    subtitle = "Incorporá tu primer cliente para abrir pautas semanales y conectar sus redes."
                )
            }
        }

        items(uiState.clients, key = { "cl-${it.id}" }) { client ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, palette.hairline, RoundedCornerShape(4.dp))
                    .background(palette.stage, RoundedCornerShape(4.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${client.industry.uppercase()} · AGENCIA ${client.agencyName.uppercase()}",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.textMuted
                        )
                        Text(
                            text = client.companyName,
                            style = MaterialTheme.typography.titleLarge,
                            color = palette.textPrimary
                        )
                        Text(
                            text = "Aprueba: ${client.contactFullName} (${client.contactEmail})",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                    }
                    if (role != UserRole.CLIENTE) {
                        IconButton(onClick = { viewModel.deleteClient(client.id) }) {
                            Icon(
                                imageVector = Icons.Outlined.DeleteOutline,
                                contentDescription = "Eliminar cliente",
                                tint = palette.textMuted
                            )
                        }
                    }
                }

                HorizontalDivider(thickness = 1.dp, color = palette.hairline)

                Text(
                    text = "REDES (TOCÁ UNA PARA CONECTAR O DESCONECTAR)",
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.textMuted
                )

                // Matriz de 3 bahías OAuth (IG · TT · YT)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    SocialPlatform.entries.forEach { platform ->
                        val conn = client.connections.find { it.platform == platform }
                        val connected = conn?.isConnected == true
                        val borderCol = if (connected) palette.tallyLive.copy(alpha = 0.65f) else palette.hairline
                        val dotCol = if (connected) palette.tallyLive else palette.textMuted

                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .border(1.dp, borderCol, RoundedCornerShape(3.dp))
                                .background(
                                    if (connected) palette.tallyLiveBg.copy(alpha = 0.35f) else palette.canvas,
                                    RoundedCornerShape(3.dp)
                                )
                                .clickable {
                                    viewModel.togglePlatformOAuth(
                                        client.id,
                                        platform,
                                        conn?.accountHandle ?: "@${client.companyName.lowercase().replace(" ", "")}"
                                    )
                                }
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = platform.shortCode,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = palette.textPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(dotCol, RoundedCornerShape(1.dp))
                                )
                            }
                            Text(
                                text = if (connected) (conn?.accountHandle ?: "@conectado") else "Sin enlace",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (connected) palette.textPrimary else palette.textMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = if (connected) "CONECTADO" else "CONECTAR →",
                                style = MaterialTheme.typography.labelSmall,
                                color = dotCol
                            )
                        }
                    }
                }
            }
        }
    }
}
