import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ImageStorage, ImageFolder, StoredImage } from './image-storage';

@Injectable()
export class LocalImageStorage extends ImageStorage {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async save(
    folder: ImageFolder,
    data: Buffer,
    extension: string,
  ): Promise<StoredImage> {
    const directory = resolve(
      this.config.get<string>('IMAGES_DIRECTORY') || 'images',
    );
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(join(directory, folder), { recursive: true });
    await writeFile(join(directory, folder, filename), data, { flag: 'wx' });
    const baseUrl = (this.config.get<string>('PUBLIC_BASE_URL') || '').replace(
      /\/+$/,
      '',
    );
    return { imageUrl: `${baseUrl}/images/${folder}/${filename}` };
  }
}
