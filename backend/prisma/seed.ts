import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  BlockReviewStatus,
  ClientConfirmationStatus,
  ContentType,
  PrismaClient,
  ProductionStatus,
  RoleCode,
  ScheduleStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedAgencyIdeas(
  agencyId: string,
  creatorUserId: string,
  clientId?: string,
) {
  const secEnt = await prisma.contentIdeaSection.upsert({
    where: { agencyId_name: { agencyId, name: 'Entretenimiento' } },
    update: {},
    create: { agencyId, name: 'Entretenimiento', color: 'ROSE', sortOrder: 0 },
  });
  const secEdu = await prisma.contentIdeaSection.upsert({
    where: { agencyId_name: { agencyId, name: 'Educativo' } },
    update: {},
    create: { agencyId, name: 'Educativo', color: 'SKY', sortOrder: 1 },
  });
  const secVen = await prisma.contentIdeaSection.upsert({
    where: { agencyId_name: { agencyId, name: 'Venta' } },
    update: {},
    create: { agencyId, name: 'Venta', color: 'EMERALD', sortOrder: 2 },
  });

  const existing = await prisma.contentIdea.count({ where: { agencyId } });
  if (existing === 0) {
    await prisma.contentIdea.createMany({
      data: [
        {
          agencyId,
          sectionId: secEdu.id,
          clientId: clientId || null,
          createdByUserId: creatorUserId,
          title: '3 errores al preparar espresso en casa (y cómo corregirlos)',
          content:
            'Gancho primeros 2 seg mostrando extracción canalizada. Explicar molienda, compactación y temperatura. Cerrar invitando a guardar el Reel.',
          isPinned: true,
        },
        {
          agencyId,
          sectionId: secEnt.id,
          clientId: clientId || null,
          createdByUserId: creatorUserId,
          title: 'POV: Cuando el cliente pide un café "bien cargado" a las 19:30',
          content:
            'Audio en tendencia + reacción rápida del barista en barra. Corte dinámico de 15 segundos ideal para alcance orgánico.',
          isPinned: false,
        },
        {
          agencyId,
          sectionId: secVen.id,
          clientId: clientId || null,
          createdByUserId: creatorUserId,
          title: 'Pack Degustación Origen Huila — Envío sin cargo 48 hs',
          content:
            'Mostrar apertura de bolsa en grano, textura del tueste medio y beneficio directo para suscriptores mensuales.',
          isPinned: false,
        },
      ],
    });
  }
}

async function main() {
  console.log('Iniciando seed de ContentSync (MySQL 3FN)...');

  // 1. Roles base
  const adminRole = await prisma.role.upsert({
    where: { code: RoleCode.ADMIN_GENERAL },
    update: {},
    create: {
      code: RoleCode.ADMIN_GENERAL,
      name: 'Administrador General',
      description: 'Gestiona todo el sistema, agencias, clientes y auditoría.',
    },
  });

  const agencyRole = await prisma.role.upsert({
    where: { code: RoleCode.AGENCIA },
    update: {},
    create: {
      code: RoleCode.AGENCIA,
      name: 'Agencia de Marketing',
      description: 'Crea y administra sus propios clientes, ideas, videos y cronogramas.',
    },
  });

  const clientRole = await prisma.role.upsert({
    where: { code: RoleCode.CLIENTE },
    update: {},
    create: {
      code: RoleCode.CLIENTE,
      name: 'Cliente',
      description: 'Confirma su identidad, visualiza su plan semanal y aprueba videos.',
    },
  });

  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed carga cuentas de demostración: no se ejecuta en producción.');
  }
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) {
    throw new Error('Definí SEED_DEFAULT_PASSWORD con la contraseña de las cuentas de demostración.');
  }
  const seedOwnerEmail = (process.env.SEED_OWNER_EMAIL || 'agencia.demo@contentsync.io').trim().toLowerCase();
  const defaultPasswordHash = await argon2.hash(seedPassword);

  // 2. Usuario ADMIN_GENERAL
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@contentsync.io' },
    update: {},
    create: {
      email: 'admin@contentsync.io',
      passwordHash: defaultPasswordHash,
      fullName: 'Sofía Martínez (Admin General)',
      roleId: adminRole.id,
      emailVerified: true,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  // 3. Agencias con sus propietarios
  const agency1Owner = await prisma.user.upsert({
    where: { email: 'agencia.nova@contentsync.io' },
    update: {},
    create: {
      email: 'agencia.nova@contentsync.io',
      passwordHash: defaultPasswordHash,
      fullName: 'Lucas Herrera (Nova Digital)',
      roleId: agencyRole.id,
      emailVerified: true,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  const agency1 = await prisma.agency.upsert({
    where: { taxId: '30-71548921-9' },
    update: {},
    create: {
      ownerUserId: agency1Owner.id,
      name: 'Nova Digital Marketing',
      taxId: '30-71548921-9',
      contactPhone: '+54 11 4890-1122',
      website: 'https://novadigital.example.com',
    },
  });

  const agency2Owner = await prisma.user.upsert({
    where: { email: 'agencia.pulso@contentsync.io' },
    update: {},
    create: {
      email: 'agencia.pulso@contentsync.io',
      passwordHash: defaultPasswordHash,
      fullName: 'Camila Gómez (Pulso Social Media)',
      roleId: agencyRole.id,
      emailVerified: true,
      timezone: 'America/Mexico_City',
    },
  });

  const agency2 = await prisma.agency.upsert({
    where: { taxId: '30-79823410-4' },
    update: {},
    create: {
      ownerUserId: agency2Owner.id,
      name: 'Pulso Social Media',
      taxId: '30-79823410-4',
      contactPhone: '+52 55 3190-4455',
      website: 'https://pulsosocial.example.com',
    },
  });

  // Agencia demo propia: SEED_OWNER_EMAIL permite iniciar sesión con un correo real
  const lucasUser = await prisma.user.upsert({
    where: { email: seedOwnerEmail },
    update: {},
    create: {
      email: seedOwnerEmail,
      passwordHash: defaultPasswordHash,
      fullName: 'Agencia Demo',
      roleId: agencyRole.id,
      emailVerified: true,
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  const lucasAgency = await prisma.agency.upsert({
    where: { ownerUserId: lucasUser.id },
    update: {},
    create: {
      ownerUserId: lucasUser.id,
      name: 'Agencia Demo',
      taxId: '20-00000000-0',
      website: 'https://contentsync.io',
    },
  });

  // 4. Clientes confirmados por agencia
  const clientUsersData = [
    {
      email: 'cliente.kafecito@contentsync.io',
      fullName: 'Martín Rossi (Kafecito Especialidad)',
      companyName: 'Kafecito Roasters S.A.',
      industry: 'Gastronomía & Café',
      agencyId: agency1.id,
    },
    {
      email: 'cliente.urbanfit@contentsync.io',
      fullName: 'Valentina Paz (UrbanFit Gym)',
      companyName: 'UrbanFit Wellness Club',
      industry: 'Fitness & Salud',
      agencyId: agency1.id,
    },
    {
      email: 'cliente.techgear@contentsync.io',
      fullName: 'Diego Vega (TechGear Store)',
      companyName: 'TechGear Latam',
      industry: 'E-Commerce & Tecnología',
      agencyId: agency2.id,
    },
    {
      email: 'cliente.lumina@contentsync.io',
      fullName: 'Elena Silva (Lumina Deco)',
      companyName: 'Lumina Diseño Interior',
      industry: 'Hogar & Decoración',
      agencyId: agency2.id,
    },
    {
      email: 'cliente.ambar@contentsync.io',
      fullName: 'Julián Méndez (Ámbar Tostadores)',
      companyName: 'Ámbar Café & Bistró',
      industry: 'Gastronomía & Especialidad',
      agencyId: lucasAgency.id,
    },
  ];

  const createdClients = [];
  for (const c of clientUsersData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash: defaultPasswordHash,
        fullName: c.fullName,
        roleId: clientRole.id,
        emailVerified: true,
      },
    });

    const client = await prisma.client.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        agencyId: c.agencyId,
        userId: user.id,
        companyName: c.companyName,
        industry: c.industry,
        confirmationStatus: ClientConfirmationStatus.CONFIRMED,
        confirmedAt: new Date(),
        isActive: true,
      },
    });
    createdClients.push(client);

  }

  // 5. Ideas privadas para Nova Digital y para Luca Segura Media
  const kafecitoClient = createdClients[0];
  const ambarClient = createdClients[4];
  await seedAgencyIdeas(agency1.id, agency1Owner.id, kafecitoClient.id);
  await seedAgencyIdeas(lucasAgency.id, lucasUser.id, ambarClient.id);
  await seedAgencyIdeas(agency2.id, agency2Owner.id, createdClients[2].id);

  // 6. Cronograma de lunes a domingo con bloques de colores para Kafecito y para Ámbar
  const weekStart = new Date('2026-10-26T00:00:00.000Z'); // Lunes
  const weekEnd = new Date('2026-11-01T00:00:00.000Z'); // Domingo

  for (const target of [
    { client: kafecitoClient, ownerId: agency1Owner.id, label: 'Kafecito' },
    { client: ambarClient, ownerId: lucasUser.id, label: 'Ámbar' },
  ]) {
    const schedule = await prisma.schedule.upsert({
      where: {
        clientId_weekStartDate: {
          clientId: target.client.id,
          weekStartDate: weekStart,
        },
      },
      update: {},
      create: {
        clientId: target.client.id,
        createdByUserId: target.ownerId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        title: `Especial Primavera (${target.label})`,
        summaryNotes: 'Contenido de la semana organizado de lunes a domingo.',
        status: ScheduleStatus.IN_REVIEW,
      },
    });

    await prisma.scheduleItem.createMany({
      data: [
        {
          scheduleId: schedule.id,
          dayOfWeek: 1,
          contentType: ContentType.REEL,
          blockTitle: 'Molienda ideal para prensa francesa',
          noteColor: 'SKY',
          notes: 'Reel explicativo mostrando el grosor del grano en primer plano.',
          caption: '¿Sabías que la molienda cambia todo? Te mostramos la ideal para prensa francesa.',
          plannedTime: '11:00',
          reviewStatus: BlockReviewStatus.APPROVED,
          productionStatus: ProductionStatus.UPLOADED,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 2,
          contentType: ContentType.STORY,
          blockTitle: 'Detrás de escena: apertura de barra',
          noteColor: 'AMBER',
          notes: 'Historias con el sonido de la máquina calentando y los primeros clientes.',
          plannedTime: '13:30',
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 3,
          contentType: ContentType.CAROUSEL,
          blockTitle: 'Receta de Cold Brew paso a paso',
          noteColor: 'LIME',
          notes: 'Carrusel de cinco imágenes: una por cada paso de la receta.',
          caption: 'Tu Cold Brew en casa, en cinco pasos. Guardá este posteo para probarlo.',
          plannedTime: '18:00',
          reviewStatus: BlockReviewStatus.CHANGES_REQUESTED,
          productionStatus: ProductionStatus.EDITED,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 4,
          contentType: ContentType.REEL,
          blockTitle: 'Mito o realidad del tueste oscuro',
          noteColor: 'ROSE',
          notes: 'Preguntas rápidas con el tostador.',
          plannedTime: '19:00',
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 5,
          contentType: ContentType.POST,
          blockTitle: 'Degustación de viernes 2x1 en filtrados',
          noteColor: 'EMERALD',
          notes: 'Imagen única con la promoción, invitando a pasar el viernes por la tarde.',
          caption: 'Este viernes, 2x1 en filtrados. ¡Te esperamos!',
          plannedTime: '17:00',
          sortOrder: 0,
        },
      ],
    });
  }

  console.log('Seed completado exitosamente:', {
    admin: adminUser.email,
    agencies: [agency1.name, agency2.name, lucasAgency.name],
    clientsCount: createdClients.length,
  });
}

main()
  .catch((e) => {
    console.error('Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
