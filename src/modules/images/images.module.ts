import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageStorage } from './image-storage';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { LocalImageStorage } from './local-image.storage';

@Module({
  imports: [ConfigModule],
  controllers: [ImagesController],
  providers: [
    ImagesService,
    { provide: ImageStorage, useClass: LocalImageStorage },
  ],
})
export class ImagesModule {}
