/**
 * Punto de entrada del backend: crea la aplicación NestJS, le aplica la seguridad HTTP
 * (Helmet y CORS), publica la web y los archivos subidos, activa la validación global y
 * la documentación Swagger, y empieza a escuchar peticiones.
 */
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { SettingsService } from './modules/settings/settings.service';

// Soporte para serializar BigInt (ej. size_bytes de los archivos) en JSON
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/** Devuelve el origen (protocolo + dominio) de una URL dentro de una lista, o una lista vacía si no es válida. */
function originOf(url: string | undefined): string[] {
  if (!url) return [];
  try {
    return [new URL(url).origin];
  } catch {
    return [];
  }
}

/** Configura y arranca el servidor. Se ejecuta una sola vez, al iniciar el proceso. */
async function bootstrap() {
  const logger = new Logger('ContentSyncBootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);
  const settings = app.get(SettingsService);
  // Confía en el primer proxy (Render, balanceador) para conocer la IP real y si la conexión es HTTPS.
  app.set('trust proxy', 1);
  // Al apagar el proceso, Nest avisa a los servicios para que cierren conexiones y temporizadores.
  app.enableShutdownHooks();

  // Todas las rutas de los controladores quedan bajo este prefijo (por defecto /api/v1).
  const apiPrefix = config.apiPrefix;
  app.setGlobalPrefix(apiPrefix);

  // Helmet va antes que los estáticos: de lo contrario index.html se sirve sin CSP ni cabeceras.
  const isHttps = config.publicBaseUrl().startsWith('https://');
  // Los enlaces firmados de fotos y videos apuntan al servicio de almacenamiento.
  const storageOrigins = originOf(config.get('S3_ENDPOINT'));
  app.use(
    helmet({
      // Necesario para las ventanas emergentes de Google / Facebook al iniciar sesión.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      strictTransportSecurity: isHttps,
      // CSP: lista de los únicos orígenes desde los que el navegador puede cargar scripts, imágenes, etc.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://connect.facebook.net'],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.googleusercontent.com',
            'https://*.fbcdn.net',
            'https://www.facebook.com',
            ...storageOrigins,
          ],
          mediaSrc: ["'self'", 'data:', 'blob:', ...storageOrigins],
          connectSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://www.facebook.com',
            'https://graph.facebook.com',
            ...config.cspExtraConnectSrc,
          ],
          frameSrc: ["'self'", 'https://accounts.google.com', 'https://www.facebook.com', 'https://web.facebook.com'],
          upgradeInsecureRequests: isHttps ? [] : null,
        },
      },
    }),
  );

  // La SPA y la API comparten origen, así que por defecto no se habilita ningún origen cruzado.
  const allowedOrigins = new Set(config.corsOrigins);
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Rutas registradas directamente en Express, sin el prefijo de la API ni los guards de Nest.
  const http = app.getHttpAdapter();

  // Healthcheck liviano para Render / balanceadores en la nube
  http.get('/health', (_req: unknown, res: any) => {
    res.status(200).json({ status: 'ok', service: 'contentsync' });
  });

  // Configuración pública para la SPA: evita duplicar en el HTML valores que viven en el servidor.
  http.get('/app-config.js', (_req: unknown, res: any) => {
    const current = settings.current();
    const payload = {
      apiBase: `/${apiPrefix}`,
      appName: current.appName,
      senderEmail: config.mailSenderAddress ?? null,
      registrationEnabled: current.registrationEnabled,
      defaultTimezone: current.defaultTimezone,
      uploadMaxMb: Math.round(config.uploadMaxBytes / (1024 * 1024)),
    };
    res
      .status(200)
      .type('application/javascript')
      .set('Cache-Control', 'no-store')
      .send(`window.__CS_CONFIG__=${JSON.stringify(payload).replace(/</g, '\\u003c')};`);
  });

  // Las fotos y los videos se sirven desde UPLOAD_DIR, que puede ser un disco persistente fuera de /public.
  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.useStaticAssets(config.uploadDir, { prefix: '/uploads/videos' });
  app.useStaticAssets(config.publicDir);

  // Validación y sanitización estricta de entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Documentación interactiva de la API en /api/v1/docs (se puede apagar con SWAGGER_ENABLED=false).
  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ContentSync API')
      .setDescription(
        'API de ContentSync: comunicación entre agencias y clientes, cronogramas, revisiones y confirmaciones.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Ingresa el Access Token JWT' },
        'jwt-auth',
      )
      .build();
    SwaggerModule.setup(`${apiPrefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  // Escucha en todas las interfaces de red: es lo que necesitan Docker y Render.
  await app.listen(config.port, '0.0.0.0');
  logger.log(`ContentSync Backend corriendo en ${config.publicBaseUrl()}/${apiPrefix}`);
  if (config.swaggerEnabled) {
    logger.log(`Swagger OpenAPI disponible en ${config.publicBaseUrl()}/${apiPrefix}/docs`);
  }
}

void bootstrap();
