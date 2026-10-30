import * as dotenv from 'dotenv';
dotenv.config();

import {
  ApprovalDecision,
  ClientConfirmationStatus,
  PrismaClient,
  PublicationStatus,
  RoleCode,
  ScheduleStatus,
  SocialPlatform,
  VideoWorkflowStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function encryptDemoToken(plainText: string): string {
  const keyHex =
    process.env.OAUTH_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(keyHex.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

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
          platforms: 'INSTAGRAM,TIKTOK,YOUTUBE',
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
          platforms: 'INSTAGRAM,TIKTOK',
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
          platforms: 'INSTAGRAM,YOUTUBE',
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

  const defaultPasswordHash = await argon2.hash('ContentSync2026!');

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

  // Usuario Luca Segura (Agencia)
  const lucasUser = await prisma.user.upsert({
    where: { email: 'lucasegura2007@gmail.com' },
    update: {},
    create: {
      email: 'lucasegura2007@gmail.com',
      passwordHash: defaultPasswordHash,
      fullName: 'SEGURA Luca',
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
      name: 'Luca Segura Media',
      taxId: '20-48192831-4',
      contactPhone: '+54 9 11 2345-6789',
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

    for (const platform of [
      SocialPlatform.INSTAGRAM,
      SocialPlatform.TIKTOK,
      SocialPlatform.YOUTUBE,
    ]) {
      await prisma.platformConnection.upsert({
        where: {
          clientId_platform: {
            clientId: client.id,
            platform,
          },
        },
        update: {},
        create: {
          clientId: client.id,
          platform,
          externalAccountId: `${platform.toLowerCase()}_${client.id.slice(0, 8)}`,
          accountHandle: `@${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18)}`,
          encryptedAccessToken: encryptDemoToken(`demo_access_${platform}_${client.id}`),
          encryptedRefreshToken: encryptDemoToken(`demo_refresh_${platform}_${client.id}`),
          tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      });
    }
  }

  // 5. Ideas privadas para Nova Digital y para Luca Segura Media
  const kafecitoClient = createdClients[0];
  const ambarClient = createdClients[4];
  await seedAgencyIdeas(agency1.id, agency1Owner.id, kafecitoClient.id);
  await seedAgencyIdeas(lucasAgency.id, lucasUser.id, ambarClient.id);
  await seedAgencyIdeas(agency2.id, agency2Owner.id, createdClients[2].id);

  // 6. Plan Semanal Lunes a Viernes con Bloques de Colores para Kafecito y para Ámbar
  const weekStart = new Date('2026-10-26T00:00:00.000Z'); // Lunes
  const weekEnd = new Date('2026-10-30T23:59:59.000Z'); // Viernes

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
        title: `Plan Lunes a Viernes · Especial Primavera (${target.label})`,
        summaryNotes: 'Pauta semanal estructurada en bloques de contenido de Lunes a Viernes.',
        status: ScheduleStatus.IN_REVIEW,
      },
    });

    const videoWed = await prisma.video.create({
      data: {
        clientId: target.client.id,
        uploadedByUserId: target.ownerId,
        title: 'Receta Cold Brew en 45 segundos',
        description: 'Descubre cómo preparamos nuestro Cold Brew infusionado durante 18 horas.',
        storageKey: 'clients/demo/cold-brew-recipe.mp4',
        durationSeconds: 45,
        sizeBytes: BigInt(28500000),
        mimeType: 'video/mp4',
        aspectRatio: '9:16',
        workflowStatus: VideoWorkflowStatus.SCHEDULED,
        hashtags: {
          create: [
            { tag: 'coldbrew', position: 0 },
            { tag: 'cafedeespecialidad', position: 1 },
            { tag: 'reels', position: 2 },
          ],
        },
        platformTargets: {
          create: [
            { platform: SocialPlatform.INSTAGRAM, shareToFeed: true },
            { platform: SocialPlatform.TIKTOK, allowDuetStitch: true },
            { platform: SocialPlatform.YOUTUBE, madeForKids: false },
          ],
        },
      },
    });

    await prisma.scheduleItem.createMany({
      data: [
        {
          scheduleId: schedule.id,
          dayOfWeek: 1,
          blockTitle: 'Educativo: Molienda ideal para prensa francesa',
          noteColor: 'SKY',
          notes: 'Subir Reel explicativo mostrando grosor de grano en primer plano.',
          plannedTime: '11:00',
          plannedPublishAt: new Date('2026-10-26T14:00:00.000Z'),
          autoPublish: true,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 2,
          blockTitle: 'Detrás de escena: Apertura de barra 07:30 AM',
          noteColor: 'AMBER',
          notes: 'Sonido ASMR de máquina de espresso calentando y primeros clientes.',
          plannedTime: '13:30',
          plannedPublishAt: new Date('2026-10-27T16:30:00.000Z'),
          autoPublish: true,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          videoId: videoWed.id,
          dayOfWeek: 3,
          blockTitle: 'Receta Cold Brew 45s (Video anexado)',
          noteColor: 'LIME',
          notes: 'Video ya cargado y configurado para emisión automática a las 18:00.',
          plannedTime: '18:00',
          plannedPublishAt: new Date('2026-10-28T21:00:00.000Z'),
          autoPublish: true,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 4,
          blockTitle: 'Entretenimiento: Mito vs Realidad del tueste oscuro',
          noteColor: 'ROSE',
          notes: 'Formato dinámico de preguntas rápidas con el tostador.',
          plannedTime: '19:00',
          plannedPublishAt: new Date('2026-10-29T22:00:00.000Z'),
          autoPublish: true,
          sortOrder: 0,
        },
        {
          scheduleId: schedule.id,
          dayOfWeek: 5,
          blockTitle: 'Venta: Degustación de Viernes 2x1 en filtrados',
          noteColor: 'EMERALD',
          notes: 'Llamado a la acción claro invitando a pasar el viernes por la tarde.',
          plannedTime: '17:00',
          plannedPublishAt: new Date('2026-10-30T20:00:00.000Z'),
          autoPublish: true,
          sortOrder: 0,
        },
      ],
    });
  }

  // Video histórico publicado para el Historial
  await prisma.video.create({
    data: {
      clientId: kafecitoClient.id,
      uploadedByUserId: agency1Owner.id,
      title: 'Tueste artesanal de granos colombianos',
      description: 'Así logramos el perfil achocolatado en nuestro lote Huila.',
      storageKey: 'clients/kafecito/2026-10/roasting-huila.mp4',
      durationSeconds: 52,
      sizeBytes: BigInt(34100000),
      mimeType: 'video/mp4',
      aspectRatio: '9:16',
      workflowStatus: VideoWorkflowStatus.PUBLISHED,
      hashtags: {
        create: [
          { tag: 'tuestedecafe', position: 0 },
          { tag: 'colombiancoffee', position: 1 },
        ],
      },
      platformTargets: {
        create: [
          { platform: SocialPlatform.INSTAGRAM, shareToFeed: true },
          { platform: SocialPlatform.TIKTOK, allowDuetStitch: true },
          { platform: SocialPlatform.YOUTUBE, madeForKids: false },
        ],
      },
      approvals: {
        create: {
          reviewerUserId: kafecitoClient.userId,
          decision: ApprovalDecision.APPROVED,
          feedbackNotes: '¡Excelente iluminación y ritmo! Aprobado para las 3 redes.',
        },
      },
      publications: {
        create: [
          {
            platform: SocialPlatform.INSTAGRAM,
            scheduledFor: new Date('2026-10-15T15:00:00.000Z'),
            publishedAt: new Date('2026-10-15T15:00:12.000Z'),
            status: PublicationStatus.PUBLISHED,
            externalPostId: 'ig_reel_9981234',
            externalPostUrl: 'https://www.instagram.com/reel/CxyzDemo1/',
            attempts: {
              create: { attemptNumber: 1, isSuccess: true, durationMs: 1420 },
            },
          },
          {
            platform: SocialPlatform.TIKTOK,
            scheduledFor: new Date('2026-10-15T15:00:00.000Z'),
            publishedAt: new Date('2026-10-15T15:00:15.000Z'),
            status: PublicationStatus.PUBLISHED,
            externalPostId: 'tt_vid_7741290',
            externalPostUrl: 'https://www.tiktok.com/@kafecito/video/7741290',
            attempts: {
              create: { attemptNumber: 1, isSuccess: true, durationMs: 1850 },
            },
          },
          {
            platform: SocialPlatform.YOUTUBE,
            scheduledFor: new Date('2026-10-15T15:00:00.000Z'),
            publishedAt: new Date('2026-10-15T15:00:19.000Z'),
            status: PublicationStatus.PUBLISHED,
            externalPostId: 'yt_short_AbCdEf123',
            externalPostUrl: 'https://youtube.com/shorts/AbCdEf123',
            attempts: {
              create: { attemptNumber: 1, isSuccess: true, durationMs: 2190 },
            },
          },
        ],
      },
    },
  });

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
