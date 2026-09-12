import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryParent } from './entities/category-parent.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repository: Repository<Category>,
    @InjectRepository(CategoryParent)
    private readonly parentRepository: Repository<CategoryParent>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertParent(dto.parentId);
    return this.save(
      this.repository.create({
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        parentId: dto.parentId,
      }),
    );
  }

  findAll(query: CategoryQueryDto): Promise<Category[]> {
    return this.repository.find({
      where: query.parentId ? { parentId: query.parentId } : {},
      relations: { parent: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { parent: true },
    });
    if (!entity) throw new NotFoundException('Category not found');
    return entity;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Category not found');
    if (dto.parentId !== undefined) {
      await this.assertParent(dto.parentId);
      entity.parentId = dto.parentId;
    }
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) {
      entity.description = dto.description.trim() || null;
    }
    return this.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    if (await this.productRepository.exists({ where: { categoryId: id } })) {
      throw new ConflictException('Category is still in use');
    }
    await this.repository.remove(entity);
  }

  async assertExists(id: string): Promise<void> {
    if (!(await this.repository.exists({ where: { id } }))) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertParent(id: string): Promise<void> {
    if (!(await this.parentRepository.exists({ where: { id } }))) {
      throw new NotFoundException('Category parent not found');
    }
  }

  private async save(entity: Category): Promise<Category> {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'driverError' in error &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        throw new ConflictException(
          'Category name already exists in this parent category',
        );
      }
      throw error;
    }
  }
}
