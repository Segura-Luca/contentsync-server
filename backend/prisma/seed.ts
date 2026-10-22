import {
  PrismaClient,
  RoleCode,
  SocialPlatform,
  VideoWorkflowStatus,
  ScheduleStatus,
  ApprovalDecision,
  PublicationStatus,
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

async function main() {
  console.log('Iniciando seed de ContentSync (PostgreSQL 3FN)...');

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
      description: 'Crea y administra sus propios clientes, videos y cronogramas.',
    },
  });

  const clientRole = await prisma.role.upsert({
    where: { code: RoleCode.CLIENTE },
    update: {},
    create: {
      code: RoleCode.CLIENTE,
      name: 'Cliente',
      description: 'Revisa cronogramas semanales, aprueba o solicita cambios en videos.',
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

  // 3. Dos Agencias con sus propietarios
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

  // 4. Cuatro Clientes (2 en Agencia Nova, 2 en Agencia Pulso)
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
      },
    });
    createdClients.push(client);

    // Conexiones OAuth cifradas para las 3 plataformas en cada cliente
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
          accountHandle: `@${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          encryptedAccessToken: encryptDemoToken(`demo_access_${platform}_${client.id}`),
          encryptedRefreshToken: encryptDemoToken(`demo_refresh_${platform}_${client.id}`),
          tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      });
    }
  }

  // 5. Cronograma semanal y videos de ejemplo para el Cliente 1 (Kafecito)
  const firstClient = createdClients[0];
  const weekStart = new Date('2026-10-19T00:00:00.000Z');
  const weekEnd = new Date('2026-10-25T23:59:59.000Z');

  const schedule = await prisma.schedule.upsert({
    where: {
      clientId_weekStartDate: {
        clientId: firstClient.id,
        weekStartDate: weekStart,
      },
    },
    update: {},
    create: {
      clientId: firstClient.id,
      createdByUserId: agency1Owner.id,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      title: 'Semana Lanzamiento Cold Brew Primavera',
      summaryNotes: '3 Reels/Shorts enfocados en preparación en frío y detrás de escena.',
      status: ScheduleStatus.IN_REVIEW,
    },
  });

  const videoReview = await prisma.video.create({
    data: {
      clientId: firstClient.id,
      uploadedByUserId: agency1Owner.id,
      title: 'Receta Cold Brew en 45 segundos',
      description: 'Descubre cómo preparamos nuestro Cold Brew infusionado durante 18 horas.',
      storageKey: 'clients/kafecito/2026-10/cold-brew-recipe.mp4',
      thumbnailKey: 'clients/kafecito/2026-10/cold-brew-thumb.jpg',
      durationSeconds: 45,
      sizeBytes: BigInt(28500000),
      mimeType: 'video/mp4',
      aspectRatio: '9:16',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      hashtags: {
        create: [
          { tag: 'coldbrew', position: 0 },
          { tag: 'cafedeespecialidad', position: 1 },
          { tag: 'barista', position: 2 },
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

  await prisma.scheduleItem.create({
    data: {
      scheduleId: schedule.id,
      videoId: videoReview.id,
      dayOfWeek: 3,
      plannedPublishAt: new Date('2026-10-23T18:00:00.000Z'),
      notes: 'Publicar en horario pico de merienda.',
    },
  });

  // Video ya aprobado y publicado para probar el Historial
  const videoPublished = await prisma.video.create({
    data: {
      clientId: firstClient.id,
      uploadedByUserId: agency1Owner.id,
      title: 'Tueste artesanal de granos colombianos',
      description: 'Así logramos el perfil achocolatado en nuestro lote Huila.',
      storageKey: 'clients/kafecito/2026-10/roasting-huila.mp4',
      thumbnailKey: 'clients/kafecito/2026-10/roasting-thumb.jpg',
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
          reviewerUserId: firstClient.userId,
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
              create: {
                attemptNumber: 1,
                isSuccess: true,
                durationMs: 1420,
              },
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
              create: {
                attemptNumber: 1,
                isSuccess: true,
                durationMs: 1850,
              },
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
              create: {
                attemptNumber: 1,
                isSuccess: true,
                durationMs: 2190,
              },
            },
          },
        ],
      },
    },
  });

  console.log('Seed completado exitosamente:', {
    admin: adminUser.email,
    agencies: [agency1.name, agency2.name],
    clientsCount: createdClients.length,
    sampleVideos: [videoReview.title, videoPublished.title],
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
