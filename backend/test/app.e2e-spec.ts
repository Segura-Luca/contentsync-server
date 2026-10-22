import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('ContentSync API Integration (E2E)', () => {
  let app: INestApplication;

  const mockPrisma: any = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    role: {
      upsert: jest.fn().mockResolvedValue({ id: 'role-agency', code: RoleCode.AGENCIA }),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/register -> should reject weak password with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'weak@contentsync.io',
        password: '12345', // contraseña débil
        fullName: 'Usuario Prueba',
      });

    expect(res.status).toBe(400);
  });

  it('GET /api/v1/agencies -> should block unauthenticated access with 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/agencies');
    expect(res.status).toBe(401);
  });
});
