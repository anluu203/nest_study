import {
  applyDecorators,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../core/constants/user-role.enum';
import { Roles } from '../../core/decorators/roles.decorator';
import { ImagesService, MAX_IMAGE_SIZE } from './images.service';
import type { UploadedImage } from './images.service';

function ImageUpload() {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor('file', {
        limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 0 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary' } },
      },
    }),
    ApiCreatedResponse({
      schema: {
        type: 'object',
        properties: {
          imageUrl: {
            type: 'string',
            example:
              '/images/products/550e8400-e29b-41d4-a716-446655440000.png',
          },
          mimeType: { type: 'string', example: 'image/png' },
          size: { type: 'integer', example: 1024 },
        },
      },
    }),
  );
}

@ApiTags('Images')
@ApiBearerAuth('JWT-auth')
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('avatars')
  @ImageUpload()
  uploadAvatar(@UploadedFile() file?: UploadedImage) {
    return this.images.upload('avatars', file);
  }

  @Roles(UserRole.ADMIN)
  @Post('products')
  @ImageUpload()
  uploadProduct(@UploadedFile() file?: UploadedImage) {
    return this.images.upload('products', file);
  }

  @Roles(UserRole.ADMIN)
  @Post('categories')
  @ImageUpload()
  uploadCategory(@UploadedFile() file?: UploadedImage) {
    return this.images.upload('categories', file);
  }
}
