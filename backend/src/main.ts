import * as dotenv from 'dotenv';
dotenv.config();

import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Soporte para serializar BigInt (ej. size_bytes de videos) en JSON
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('ContentSyncBootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Healthcheck liviano para Render / balanceadores en la nube
  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', service: 'contentsync' });
  });

  // Servir interfaz web Darkroom Studio en la raíz (/) respetando prefijo /api/v1
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Seguridad HTTP (Helmet calibrado para Studio SPA + API REST)
  app.use(
    helmet({
      // Necesario para las ventanas emergentes de Google / Facebook al iniciar sesión.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://accounts.google.com',
            'https://connect.facebook.net',
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.googleusercontent.com',
            'https://*.fbcdn.net',
            'https://www.facebook.com',
          ],
          mediaSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: [
            "'self'",
            'http://localhost:3000',
            'https://*.onrender.com',
            'https://accounts.google.com',
            'https://www.facebook.com',
            'https://graph.facebook.com',
          ],
          frameSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://www.facebook.com',
            'https://web.facebook.com',
          ],
        },
      },
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Validación y sanitización estricta de entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Documentación OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ContentSync API')
    .setDescription(
      'API RESTful para gestión de agencias de marketing, cronogramas semanales, flujo de aprobación de clientes y publicación multiplataforma (Instagram Reels, TikTok, YouTube Shorts).',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingresa el Access Token JWT',
      },
      'jwt-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`ContentSync Backend corriendo en http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger OpenAPI disponible en http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
