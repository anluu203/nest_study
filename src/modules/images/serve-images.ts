import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';

export function serveImages(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  app.useStaticAssets(
    resolve(config.get<string>('IMAGES_DIRECTORY') || 'images'),
    {
      prefix: '/images/',
      index: false,
      dotfiles: 'deny',
      setHeaders: (response: ServerResponse) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
      },
    },
  );
}
