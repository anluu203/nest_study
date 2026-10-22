import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    this.assertDiscount(dto.price, dto.discountPrice);
    await this.assertCategory(dto.categoryId);
    const product = this.repository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      price: dto.price,
      categoryId: dto.categoryId,
      isActive: true,
      sku: dto.sku?.trim() || null,
      brand: dto.brand?.trim() || null,
      discountPrice: dto.discountPrice ?? null,
      stockQuantity: dto.stockQuantity ?? null,
      warrantyMonths: dto.warrantyMonths ?? null,
      images: dto.images ?? (dto.imageUrl ? [dto.imageUrl.trim()] : []),
      specifications: dto.specifications ?? null,
    });
    return this.saveProduct(this.repository, product);
  }

  async findAll(query: ProductQueryDto) {
    const builder = this.repository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('category.parent', 'parent')
      .where('product.isActive = true');

    if (query.search?.trim()) {
      builder.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.categoryId) {
      builder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    const [items, totalCount] = await builder
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(totalCount / query.pageSize);
    return {
      items,
      totalCount,
      pageNumber: query.page,
      pageSize: query.pageSize,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.repository.findOne({
      where: { id, isActive: true },
      relations: { category: { parent: true } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAvailable(id: string): Promise<Product> {
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.dataSource.transaction(async (manager) => {
      const productRepository = manager.getRepository(Product);
      const product = await productRepository.findOne({
        where: { id, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      this.assertDiscount(
        dto.price ?? product.price,
        dto.discountPrice !== undefined
          ? dto.discountPrice
          : product.discountPrice,
      );
      for (const field of ['sku', 'brand'] as const) {
        if (dto[field] !== undefined)
          product[field] = dto[field]?.trim() || null;
      }
      for (const field of [
        'discountPrice',
        'stockQuantity',
        'warrantyMonths',
        'specifications',
      ] as const) {
        if (dto[field] !== undefined)
          Object.assign(product, { [field]: dto[field] });
      }
      if (dto.images !== undefined) product.images = dto.images;

      if (dto.categoryId !== undefined) {
        const categoryExists = await manager
          .getRepository(Category)
          .exists({ where: { id: dto.categoryId } });
        if (!categoryExists) throw new NotFoundException('Category not found');
        product.categoryId = dto.categoryId;
      }
      if (dto.name !== undefined) product.name = dto.name.trim();
      if (dto.description !== undefined) {
        product.description = dto.description.trim() || null;
      }
      if (dto.imageUrl !== undefined) {
        product.imageUrl = dto.imageUrl?.trim() || null;
      }

      if (dto.price !== undefined && dto.price !== product.price) {
        product.price = dto.price;
        await this.refreshActiveCartPrices(manager, id, dto.price);
      }
      await this.saveProduct(productRepository, product);
    });
    return this.findOne(id);
  }

  async archive(id: string): Promise<void> {
    const product = await this.repository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    product.isActive = false;
    await this.repository.save(product);
  }

  private async assertCategory(id: string): Promise<void> {
    if (
      !(await this.dataSource.getRepository(Category).exists({ where: { id } }))
    ) {
      throw new NotFoundException('Category not found');
    }
  }

  private assertDiscount(
    price: string,
    discount: string | null | undefined,
  ): void {
    if (
      discount != null &&
      (BigInt(discount) < 0n || BigInt(discount) > BigInt(price))
    ) {
      throw new BadRequestException(
        'discountPrice must be between zero and price',
      );
    }
  }

  private async saveProduct(
    repository: Repository<Product>,
    product: Product,
  ): Promise<Product> {
    try {
      return await repository.save(product);
    } catch (error) {
      if (
        (error as { driverError?: { code?: string; constraint?: string } })
          ?.driverError?.constraint === 'UQ_products_sku' &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        throw new ConflictException('Product SKU already exists');
      }
      throw error;
    }
  }

  private async refreshActiveCartPrices(
    manager: EntityManager,
    productId: string,
    price: string,
  ): Promise<void> {
    const itemRepository = manager.getRepository(OrderItem);
    const activeItems = await itemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.order', 'order')
      .where('item.productId = :productId', { productId })
      .andWhere('order.status = :status', {
        status: OrderStatus.ADDING_ITEM,
      })
      .getMany();

    if (!activeItems.length) return;
    for (const item of activeItems) item.unitPrice = price;
    await itemRepository.save(activeItems);

    const orderIds = [...new Set(activeItems.map((item) => item.orderId))];
    for (const orderId of orderIds) {
      const items = await itemRepository.find({ where: { orderId } });
      const total = items.reduce(
        (sum, item) => sum + BigInt(item.unitPrice) * BigInt(item.quantity),
        0n,
      );
      await manager
        .getRepository(Order)
        .update(orderId, { totalPrice: total.toString() });
    }
  }
}
