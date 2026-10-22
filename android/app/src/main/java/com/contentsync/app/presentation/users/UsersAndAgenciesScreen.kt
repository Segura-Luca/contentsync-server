package com.contentsync.app.presentation.users

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentsync.app.core.designsystem.EmptyStateCard
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
    var showCreateAgencyForm by remember { mutableStateOf(false) }
    var showCreateClientForm by remember { mutableStateOf(false) }

    // Campos Agencia
    var agencyName by remember { mutableStateOf("") }
    var agencyTaxId by remember { mutableStateOf("") }
    var agencyOwnerName by remember { mutableStateOf("") }
    var agencyOwnerEmail by remember { mutableStateOf("") }
    var agencyPhone by remember { mutableStateOf("") }

    // Campos Cliente
    var clientCompany by remember { mutableStateOf("") }
    var clientIndustry by remember { mutableStateOf("") }
    var clientContactName by remember { mutableStateOf("") }
    var clientContactEmail by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (role == UserRole.ADMIN_GENERAL) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "ABM de Agencias (Exclusivo Admin General)",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    FilledTonalButton(onClick = { showCreateAgencyForm = !showCreateAgencyForm }) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nueva Agencia")
                    }
                }
            }

            if (showCreateAgencyForm) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Registrar Nueva Agencia", fontWeight = FontWeight.Bold)
                            OutlinedTextField(
                                value = agencyName,
                                onValueChange = { agencyName = it },
                                label = { Text("Nombre de Agencia") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = agencyTaxId,
                                onValueChange = { agencyTaxId = it },
                                label = { Text("CUIT / Tax ID (UNIQUE)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = agencyOwnerName,
                                onValueChange = { agencyOwnerName = it },
                                label = { Text("Responsable") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = agencyOwnerEmail,
                                onValueChange = { agencyOwnerEmail = it },
                                label = { Text("Email corporativo") },
                                modifier = Modifier.fillMaxWidth()
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
                                }
                            ) {
                                Text("Guardar Agencia")
                            }
                        }
                    }
                }
            }

            items(uiState.agencies, key = { it.id }) { agency ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = agency.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Tax ID: ${agency.taxId} • ${agency.ownerEmail}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            AssistChip(
                                onClick = { viewModel.toggleAgencySuspension(agency.id) },
                                label = {
                                    Text(if (agency.isSuspended) "Suspendida (Reactivar)" else "Activa (Suspender)")
                                }
                            )
                            IconButton(onClick = { viewModel.deleteAgency(agency.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Eliminar agencia")
                            }
                        }
                    }
                }
            }
        }

        // Sección de Clientes y Conexiones OAuth de Publicación
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (role == UserRole.AGENCIA) "Mis Clientes y Conexiones OAuth" else "Clientes Registrados",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Solo ves y administras clientes dentro del alcance de tu rol.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (role != UserRole.CLIENTE) {
                    FilledTonalButton(onClick = { showCreateClientForm = !showCreateClientForm }) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nuevo Cliente")
                    }
                }
            }
        }

        if (showCreateClientForm && role != UserRole.CLIENTE) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Crear Cliente para mi Agencia", fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = clientCompany,
                            onValueChange = { clientCompany = it },
                            label = { Text("Empresa / Marca") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = clientIndustry,
                            onValueChange = { clientIndustry = it },
                            label = { Text("Rubro / Industria") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = clientContactName,
                            onValueChange = { clientContactName = it },
                            label = { Text("Nombre del Contacto") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = clientContactEmail,
                            onValueChange = { clientContactEmail = it },
                            label = { Text("Email del Cliente (acceso a la app)") },
                            modifier = Modifier.fillMaxWidth()
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
                            }
                        ) {
                            Text("Crear Cliente")
                        }
                    }
                }
            }
        }

        if (uiState.clients.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "Sin clientes asignados",
                    subtitle = "Agrega tu primer cliente para gestionar sus cronogramas y redes."
                )
            }
        }

        items(uiState.clients, key = { it.id }) { client ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Business,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = client.companyName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${client.industry} • Agencia: ${client.agencyName}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    text = "Contacto: ${client.contactFullName} (${client.contactEmail})",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                        if (role != UserRole.CLIENTE) {
                            IconButton(onClick = { viewModel.deleteClient(client.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Eliminar cliente")
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = "Conexiones OAuth de Publicación (Tokens cifrados AES-256-GCM en BD):",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        SocialPlatform.entries.forEach { platform ->
                            val conn = client.connections.find { it.platform == platform }
                            val isConnected = conn?.isConnected == true
                            FilterChip(
                                selected = isConnected,
                                onClick = {
                                    viewModel.togglePlatformOAuth(
                                        client.id,
                                        platform,
                                        conn?.accountHandle ?: "@cuenta"
                                    )
                                },
                                leadingIcon = {
                                    Icon(
                                        Icons.Default.Link,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                label = {
                                    Text(
                                        "${platform.name}: ${if (isConnected) conn?.accountHandle else "Conectar OAuth"}",
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
