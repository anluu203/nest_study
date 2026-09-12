import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async getCart(userId: string) {
    const cart = await this.orderRepository.findOne({
      where: { userId, status: OrderStatus.ADDING_ITEM },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return cart ?? this.emptyCart();
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<Order> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const product = await this.findActiveProduct(manager, dto.productId);
          let cart = await this.findActiveCart(manager, userId, true);
          if (!cart) {
            cart = manager.getRepository(Order).create({
              userId,
              status: OrderStatus.ADDING_ITEM,
              totalPrice: '0',
            });
            cart = await manager.getRepository(Order).save(cart);
          }

          const itemRepository = manager.getRepository(OrderItem);
          const existing = await itemRepository.findOne({
            where: { orderId: cart.id, productId: product.id },
          });
          if (existing) {
            if (existing.quantity + dto.quantity > 999) {
              throw new BadRequestException(
                'Cart item quantity cannot exceed 999',
              );
            }
            existing.quantity += dto.quantity;
            existing.unitPrice = product.price;
            await itemRepository.save(existing);
          } else {
            await itemRepository.save(
              itemRepository.create({
                orderId: cart.id,
                productId: product.id,
                quantity: dto.quantity,
                unitPrice: product.price,
              }),
            );
          }

          await this.recalculateTotal(cart.id, manager);
          return this.loadCart(cart.id, manager);
        });
      } catch (error) {
        if (attempt === 0 && this.isUniqueViolation(error)) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not create an active cart');
  }

  async updateCartItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.requireActiveCart(manager, userId);
      const itemRepository = manager.getRepository(OrderItem);
      const item = await itemRepository.findOne({
        where: { id: itemId, orderId: cart.id },
      });
      if (!item) throw new NotFoundException('Cart item not found');

      const product = await this.findActiveProduct(manager, item.productId);
      item.quantity = dto.quantity;
      item.unitPrice = product.price;
      await itemRepository.save(item);
      await this.recalculateTotal(cart.id, manager);
      return this.loadCart(cart.id, manager);
    });
  }

  async removeCartItem(userId: string, itemId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.requireActiveCart(manager, userId);
      const itemRepository = manager.getRepository(OrderItem);
      const item = await itemRepository.findOne({
        where: { id: itemId, orderId: cart.id },
      });
      if (!item) throw new NotFoundException('Cart item not found');
      await itemRepository.remove(item);
      await this.recalculateTotal(cart.id, manager);
      return this.loadCart(cart.id, manager);
    });
  }

  async clearCart(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.findActiveCart(manager, userId, true);
      if (cart) await manager.getRepository(Order).remove(cart);
    });
  }

  async checkout(userId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await this.requireActiveCart(manager, userId);
      const itemRepository = manager.getRepository(OrderItem);
      const items = await itemRepository.find({
        where: { orderId: cart.id },
        relations: { product: true },
      });
      if (!items.length) throw new BadRequestException('Cart is empty');

      for (const item of items) {
        if (!item.product?.isActive) {
          throw new ConflictException(
            `Product ${item.productId} is no longer available`,
          );
        }
        item.unitPrice = item.product.price;
      }
      await itemRepository.save(items);
      cart.totalPrice = this.calculateTotal(items);
      cart.status = OrderStatus.PROCESSING;
      await manager.getRepository(Order).save(cart);
      return this.loadOrder(cart.id, manager);
    });
  }

  findUserOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId, status: Not(OrderStatus.ADDING_ITEM) },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async findOrderById(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        userId,
        status: Not(OrderStatus.ADDING_ITEM),
      },
      relations: { items: { product: true } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAdminOrders(query: AdminOrderQueryDto) {
    if (query.status === OrderStatus.ADDING_ITEM) {
      throw new BadRequestException(
        'Active carts are not included in the admin order list',
      );
    }
    const builder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .where('order.status != :cartStatus', {
        cartStatus: OrderStatus.ADDING_ITEM,
      });
    if (query.status) {
      builder.andWhere('order.status = :status', { status: query.status });
    }
    const [items, totalCount] = await builder
      .orderBy('order.createdAt', 'DESC')
      .addOrderBy('order.id', 'DESC')
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

  async updateOrderStatus(
    orderId: string,
    target: OrderStatus,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order || order.status === OrderStatus.ADDING_ITEM) {
        throw new NotFoundException('Order not found');
      }
      const allowedNext: Partial<Record<OrderStatus, OrderStatus>> = {
        [OrderStatus.PROCESSING]: OrderStatus.PREPARING,
        [OrderStatus.PREPARING]: OrderStatus.SHIPPING,
        [OrderStatus.SHIPPING]: OrderStatus.DONE,
      };
      if (allowedNext[order.status] !== target) {
        throw new ConflictException(
          `Invalid order status transition from ${order.status} to ${target}`,
        );
      }
      order.status = target;
      await repository.save(order);
      return this.loadOrder(order.id, manager);
    });
  }

  async recalculateTotal(
    orderId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<string> {
    const items = await manager.getRepository(OrderItem).find({
      where: { orderId },
    });
    const totalPrice = this.calculateTotal(items);
    await manager.getRepository(Order).update(orderId, { totalPrice });
    return totalPrice;
  }

  private calculateTotal(items: OrderItem[]): string {
    const total = items.reduce(
      (sum, item) => sum + BigInt(item.unitPrice) * BigInt(item.quantity),
      0n,
    );
    if (total > 9223372036854775807n) {
      throw new BadRequestException('Order total exceeds the supported amount');
    }
    return total.toString();
  }

  private async findActiveCart(
    manager: EntityManager,
    userId: string,
    lock: boolean,
  ): Promise<Order | null> {
    const builder = manager
      .getRepository(Order)
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .andWhere('order.status = :status', {
        status: OrderStatus.ADDING_ITEM,
      })
      .orderBy('order.createdAt', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .limit(1);
    if (lock) builder.setLock('pessimistic_write');
    return builder.getOne();
  }

  private async requireActiveCart(
    manager: EntityManager,
    userId: string,
  ): Promise<Order> {
    const cart = await this.findActiveCart(manager, userId, true);
    if (!cart) throw new NotFoundException('Active cart not found');
    return cart;
  }

  private async findActiveProduct(
    manager: EntityManager,
    productId: string,
  ): Promise<Product> {
    const product = await manager.getRepository(Product).findOne({
      where: { id: productId, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private loadCart(orderId: string, manager: EntityManager): Promise<Order> {
    return this.loadOrder(orderId, manager);
  }

  private async loadOrder(
    orderId: string,
    manager: EntityManager,
  ): Promise<Order> {
    const order = await manager.getRepository(Order).findOne({
      where: { id: orderId },
      relations: { items: { product: true } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private emptyCart() {
    return {
      id: null,
      status: OrderStatus.ADDING_ITEM,
      items: [],
      totalPrice: '0',
    };
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
