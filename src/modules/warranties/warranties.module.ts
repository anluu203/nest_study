import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminWarrantiesController } from './admin-warranties.controller';
import { WarrantyEvent } from './entities/warranty-event.entity';
import { WarrantyProduct } from './entities/warranty-product.entity';
import { WarrantyTicket } from './entities/warranty-ticket.entity';
import { WarrantiesController } from './warranties.controller';
import { WarrantiesService } from './warranties.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WarrantyProduct, WarrantyTicket, WarrantyEvent]),
  ],
  controllers: [WarrantiesController, AdminWarrantiesController],
  providers: [WarrantiesService],
  exports: [WarrantiesService],
})
export class WarrantiesModule {}
