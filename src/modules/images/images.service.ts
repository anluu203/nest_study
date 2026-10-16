import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ImageFolder, ImageStorage } from './image-storage';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class ImagesService {
  constructor(private readonly storage: ImageStorage) {}

  async upload(folder: ImageFolder, file?: UploadedImage) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'An image file is required in the file field',
      );
    }
    if (file.buffer.length > MAX_IMAGE_SIZE) {
      throw new PayloadTooLargeException('Image must not exceed 5 MB');
    }
    const format = this.detectFormat(file.buffer);
    if (!format || file.mimetype !== format.mimeType) {
      throw new BadRequestException(
        'Only JPEG, PNG, GIF and WebP images with matching content are allowed',
      );
    }
    const stored = await this.storage.save(
      folder,
      file.buffer,
      format.extension,
    );
    return { ...stored, mimeType: format.mimeType, size: file.buffer.length };
  }

  private detectFormat(data: Buffer) {
    if (
      data.length >= 3 &&
      data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    ) {
      return { extension: 'jpg', mimeType: 'image/jpeg' };
    }
    if (
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return { extension: 'png', mimeType: 'image/png' };
    }
    if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))) {
      return { extension: 'gif', mimeType: 'image/gif' };
    }
    if (
      data.length >= 12 &&
      data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { extension: 'webp', mimeType: 'image/webp' };
    }
    return null;
  }
}
