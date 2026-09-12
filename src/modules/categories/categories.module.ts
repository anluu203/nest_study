import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryParentsController } from './category-parents.controller';
import { CategoryParentsService } from './category-parents.service';
import { CategoryParent } from './entities/category-parent.entity';
import { Category } from './entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryParent, Category, Product])],
  controllers: [CategoryParentsController, CategoriesController],
  providers: [CategoryParentsService, CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
