import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryParent } from './entities/category-parent.entity';
import { CreateCategoryParentDto } from './dto/create-category-parent.dto';
import { UpdateCategoryParentDto } from './dto/update-category-parent.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryParentsService {
  constructor(
    @InjectRepository(CategoryParent)
    private readonly repository: Repository<CategoryParent>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryParentDto): Promise<CategoryParent> {
    const entity = this.repository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl ?? null,
    });
    return this.save(entity);
  }

  findAll(): Promise<CategoryParent[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<CategoryParent> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Category parent not found');
    return entity;
  }

  async update(
    id: string,
    dto: UpdateCategoryParentDto,
  ): Promise<CategoryParent> {
    const entity = await this.findOne(id);
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) {
      entity.description = dto.description.trim() || null;
    }
    if (dto.imageUrl !== undefined) entity.imageUrl = dto.imageUrl ?? null;
    return this.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    if (await this.categoryRepository.exists({ where: { parentId: id } })) {
      throw new ConflictException('Category parent is still in use');
    }
    await this.repository.remove(entity);
  }

  private async save(entity: CategoryParent): Promise<CategoryParent> {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Category parent name already exists');
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      typeof error === 'object' &&
        error !== null &&
        'driverError' in error &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '23505',
    );
  }
}
