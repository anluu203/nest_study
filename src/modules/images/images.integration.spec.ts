import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import request from 'supertest';
import { UserRole } from '../../core/constants/user-role.enum';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { ImagesModule } from './images.module';
import { MAX_IMAGE_SIZE } from './images.service';
import { serveImages } from './serve-images';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5f8AAAAASUVORK5CYII=',
  'base64',
);

describe('Image uploads (HTTP, local storage and real auth guards)', () => {
  let app: NestExpressApplication;
  let directory: string;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'be-study-images-'));
    const module = await Test.createTestingModule({
      imports: [
        ImagesModule,
        JwtModule.register({ secret: 'image-upload-test-secret' }),
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({ IMAGES_DIRECTORY: directory, PUBLIC_BASE_URL: '' }),
      )
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors({ origin: 'http://localhost:5173' });
    serveImages(app);
    await app.init();
    const jwt = module.get(JwtService);
    userToken = jwt.sign({ sub: 'user-id', role: UserRole.USER });
    adminToken = jwt.sign({ sub: 'admin-id', role: UserRole.ADMIN });
  });

  afterAll(async () => {
    await app?.close();
    // Only remove the exact temporary directory created by this suite.
    if (
      directory &&
      dirname(resolve(directory)) === resolve(tmpdir()) &&
      basename(directory).startsWith('be-study-images-')
    ) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['avatars', 'products', 'categories'])(
    'rejects anonymous uploads to %s',
    async (folder) => {
      await request(app.getHttpServer())
        .post(`/api/v1/images/${folder}`)
        .expect(401);
    },
  );

  it.each(['products', 'categories'])(
    'requires ADMIN for %s',
    async (folder) => {
      await request(app.getHttpServer())
        .post(`/api/v1/images/${folder}`)
        .auth(userToken, { type: 'bearer' })
        .attach('file', png, {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(403);
    },
  );

  it.each(['avatars', 'products', 'categories'])(
    'stores and publicly serves %s under a generated filename',
    async (folder) => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/images/${folder}`)
        .auth(folder === 'avatars' ? userToken : adminToken, { type: 'bearer' })
        .attach('file', png, {
          filename: 'untrusted.html',
          contentType: 'image/png',
        })
        .expect(201);
      const body = response.body as {
        imageUrl: string;
        mimeType: string;
        size: number;
      };
      expect(body.imageUrl).toMatch(
        new RegExp(`^/images/${folder}/[a-f0-9-]+\\.png$`),
      );
      expect(body.mimeType).toBe('image/png');
      expect(body.size).toBe(png.length);
      expect(
        await readFile(join(directory, body.imageUrl.slice('/images/'.length))),
      ).toEqual(png);
      const image = await request(app.getHttpServer())
        .get(body.imageUrl)
        .set('Origin', 'http://localhost:5173')
        .expect(200)
        .expect('Content-Type', /image\/png/)
        .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
        .expect('X-Content-Type-Options', 'nosniff');
      expect(image.body).toEqual(png);
    },
  );

  it('rejects missing, empty, non-image and MIME-spoofed files without writing them', async () => {
    const before = await readdir(join(directory, 'avatars'));
    const endpoint = '/api/v1/images/avatars';
    await request(app.getHttpServer())
      .post(endpoint)
      .auth(userToken, { type: 'bearer' })
      .expect(400);
    for (const [buffer, contentType] of [
      [Buffer.alloc(0), 'image/png'],
      [Buffer.from('<script>alert(1)</script>'), 'image/png'],
      [png, 'image/jpeg'],
    ] as const) {
      await request(app.getHttpServer())
        .post(endpoint)
        .auth(userToken, { type: 'bearer' })
        .attach('file', buffer, { filename: 'photo.png', contentType })
        .expect(400);
    }
    expect(await readdir(join(directory, 'avatars'))).toEqual(before);
  });

  it('rejects files over 5 MB', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/images/avatars')
      .auth(userToken, { type: 'bearer' })
      .attach('file', Buffer.alloc(MAX_IMAGE_SIZE + 1), {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(413);
  });

  it('rejects unexpected file fields and multiple files', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/images/avatars')
      .auth(userToken, { type: 'bearer' })
      .attach('image', png, 'photo.png')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/images/avatars')
      .auth(userToken, { type: 'bearer' })
      .attach('file', png, 'one.png')
      .attach('file', png, 'two.png')
      .expect(400);
  });

  it('does not expose files outside /images', async () => {
    await request(app.getHttpServer()).get('/images/%2e%2e/.env').expect(404);
  });
});
