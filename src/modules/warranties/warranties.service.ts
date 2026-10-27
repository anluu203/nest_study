import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  IsNull,
  Repository,
} from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { CreateWarrantyRequestDto } from './dto/create-warranty-request.dto';
import {
  RegisterWarrantyProductDto,
  UpdateWarrantyProductDto,
} from './dto/register-warranty-product.dto';
import { UpdateWarrantyRequestDto } from './dto/update-warranty-request.dto';
import {
  AdminWarrantyProductQueryDto,
  AdminWarrantyRequestQueryDto,
  WarrantyProductQueryDto,
  WarrantyQueryDto,
  WarrantyRequestQueryDto,
} from './dto/warranty-query.dto';
import { WarrantyEvent } from './entities/warranty-event.entity';
import { WarrantyProduct } from './entities/warranty-product.entity';
import {
  WarrantyStatus,
  WarrantyTicket,
} from './entities/warranty-ticket.entity';
import {
  coverageStatus,
  isUniqueViolation,
  todayInVietnam,
  toApiStatus,
  toDatabaseStatus,
  warrantyExpiry,
  WARRANTY_STATUS_FLOW,
} from './warranty.utils';

@Injectable()
export class WarrantiesService {
  constructor(
    @InjectRepository(WarrantyProduct)
    private readonly productRepository: Repository<WarrantyProduct>,
    @InjectRepository(WarrantyTicket)
    private readonly ticketRepository: Repository<WarrantyTicket>,
    private readonly dataSource: DataSource,
  ) {}

  /** Called inside the same transaction that marks an order Done. */
  async registerDeliveredOrder(
    manager: EntityManager,
    order: Order,
  ): Promise<void> {
    const items = await manager.getRepository(OrderItem).find({
      where: { orderId: order.id },
      relations: { product: true },
    });
    const purchasedAt = todayInVietnam();
    const repository = manager.getRepository(WarrantyProduct);
    const units = items.flatMap((item) =>
      Array.from({ length: item.quantity }, (_, index) =>
        repository.create({
          orderItemId: item.id,
          unitNumber: index + 1,
          serialNumber: null,
          purchasedAt,
          warrantyMonths: item.product.warrantyMonths,
          expiresAt: warrantyExpiry(purchasedAt, item.product.warrantyMonths),
        }),
      ),
    );
    if (units.length) await repository.save(units, { chunk: 100 });
  }

  async findProducts(
    query: WarrantyProductQueryDto | AdminWarrantyProductQueryDto,
    ownerId?: string,
  ) {
    const builder = this.productBuilder();
    const owner = ownerId ?? ('ownerId' in query ? query.ownerId : undefined);
    if (owner) builder.andWhere('order.userId = :owner', { owner });
    if (query.search) {
      const search = this.searchPattern(query.search);
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('product.name ILIKE :search', { search })
            .orWhere('unit.serialNumber ILIKE :search', { search })
            .orWhere('order.orderCode ILIKE :search', { search });
        }),
      );
    }
    const today = todayInVietnam();
    switch (query.coverage) {
      case 'active':
        builder.andWhere(
          'unit.warrantyMonths > 0 AND unit.purchasedAt <= :today AND unit.expiresAt >= :today',
          { today },
        );
        break;
      case 'expired':
        builder.andWhere(
          'unit.warrantyMonths > 0 AND unit.expiresAt < :today',
          { today },
        );
        break;
      case 'unknown':
        builder.andWhere(
          '(unit.warrantyMonths IS NULL OR unit.expiresAt IS NULL)',
        );
        break;
      case 'not_covered':
        builder.andWhere('unit.warrantyMonths = 0');
        break;
      case 'not_started':
        builder.andWhere(
          'unit.warrantyMonths > 0 AND unit.expiresAt IS NOT NULL AND unit.purchasedAt > :today',
          { today },
        );
        break;
    }
    const [items, total] = await builder
      .orderBy('unit.purchasedAt', 'DESC')
      .addOrderBy('unit.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return this.page(
      items.map((unit) => this.productView(unit, ownerId === undefined)),
      total,
      query,
    );
  }

  async findProduct(id: string, ownerId?: string) {
    const builder = this.productBuilder().andWhere('unit.id = :id', { id });
    if (ownerId) builder.andWhere('order.userId = :ownerId', { ownerId });
    const unit = await builder.getOne();
    if (!unit) throw new NotFoundException('Warranty product not found');
    return this.productView(unit, ownerId === undefined);
  }

  async registerProduct(dto: RegisterWarrantyProductDto) {
    if (dto.purchasedAt > todayInVietnam()) {
      throw new BadRequestException('Purchase date cannot be in the future');
    }
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        // Serialize against delivery registration, and verify the owning order.
        const itemReference = await manager
          .getRepository(OrderItem)
          .findOneBy({ id: dto.orderItemId });
        if (!itemReference) throw new NotFoundException('Order item not found');
        const order = await manager.getRepository(Order).findOne({
          where: { id: itemReference.orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order || order.status !== OrderStatus.DONE) {
          throw new ConflictException(
            'Only delivered orders can be registered for warranty',
          );
        }
        if (dto.unitNumber > itemReference.quantity) {
          throw new BadRequestException(
            'Unit number exceeds the purchased quantity',
          );
        }
        const months = dto.warrantyMonths ?? null;
        const repository = manager.getRepository(WarrantyProduct);
        const unit = await repository.save(
          repository.create({
            orderItemId: dto.orderItemId,
            unitNumber: dto.unitNumber,
            serialNumber: dto.serial ?? null,
            purchasedAt: dto.purchasedAt,
            warrantyMonths: months,
            expiresAt: warrantyExpiry(dto.purchasedAt, months),
          }),
        );
        return unit.id;
      });
      return this.findProduct(id);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'This purchased unit or serial is already registered',
        );
      throw error;
    }
  }

  async updateProduct(id: string, dto: UpdateWarrantyProductDto) {
    if (
      dto.serial === undefined &&
      dto.purchasedAt === undefined &&
      dto.warrantyMonths === undefined
    ) {
      throw new BadRequestException(
        'At least one warranty product field is required',
      );
    }
    if (dto.purchasedAt && dto.purchasedAt > todayInVietnam()) {
      throw new BadRequestException('Purchase date cannot be in the future');
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        const unit = await manager.getRepository(WarrantyProduct).findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!unit) throw new NotFoundException('Warranty product not found');
        const tickets = manager.getRepository(WarrantyTicket);
        const hasRequests = await tickets.existsBy({ warrantyProductId: id });
        if (
          hasRequests &&
          (dto.purchasedAt !== undefined ||
            dto.warrantyMonths !== undefined ||
            (dto.serial !== undefined &&
              unit.serialNumber !== null &&
              dto.serial !== unit.serialNumber))
        ) {
          throw new ConflictException(
            'Warranty terms and an existing serial cannot change after a request has been created',
          );
        }
        if (dto.serial !== undefined) {
          unit.serialNumber = dto.serial;
          if (hasRequests && dto.serial !== null) {
            await tickets.update(
              { warrantyProductId: id, serialNumber: IsNull() },
              { serialNumber: dto.serial },
            );
          }
        }
        if (dto.purchasedAt !== undefined) unit.purchasedAt = dto.purchasedAt;
        if (dto.warrantyMonths !== undefined)
          unit.warrantyMonths = dto.warrantyMonths;
        unit.expiresAt = warrantyExpiry(unit.purchasedAt, unit.warrantyMonths);
        await manager.getRepository(WarrantyProduct).save(unit);
      });
      return this.findProduct(id);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Serial is already registered');
      throw error;
    }
  }

  async findRequests(
    query: WarrantyRequestQueryDto | AdminWarrantyRequestQueryDto,
    ownerId?: string,
  ) {
    const builder = this.ticketBuilder();
    const owner = ownerId ?? ('ownerId' in query ? query.ownerId : undefined);
    if (owner) builder.andWhere('ticket.userId = :owner', { owner });
    if (query.status)
      builder.andWhere('ticket.status = :status', {
        status: toDatabaseStatus(query.status),
      });
    if (query.productId)
      builder.andWhere('ticket.warrantyProductId = :unitId', {
        unitId: query.productId,
      });
    if (query.search) {
      const search = this.searchPattern(query.search);
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('ticket.ticketCode ILIKE :search', { search })
            .orWhere('ticket.contactName ILIKE :search', { search })
            .orWhere('ticket.contactPhone ILIKE :search', { search })
            .orWhere('ticket.serialNumber ILIKE :search', { search })
            .orWhere('ticket.orderCode ILIKE :search', { search })
            .orWhere('product.name ILIKE :search', { search })
            .orWhere('CAST(ticket.userId AS text) ILIKE :search', { search });
        }),
      );
    }
    const [items, total] = await builder
      .orderBy('ticket.createdAt', 'DESC')
      .addOrderBy('ticket.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return this.page(
      items.map((ticket) => this.ticketView(ticket, ownerId === undefined)),
      total,
      query,
    );
  }

  async findRequest(id: string, ownerId?: string) {
    const builder = this.ticketBuilder().andWhere('ticket.id = :id', { id });
    if (ownerId) builder.andWhere('ticket.userId = :ownerId', { ownerId });
    const ticket = await builder.getOne();
    if (!ticket) throw new NotFoundException('Warranty request not found');
    return this.ticketView(ticket, ownerId === undefined);
  }

  async requestStats() {
    const rows = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('ticket.status')
      .getRawMany<{ status: WarrantyStatus; count: number }>();
    const counts = { received: 0, checking: 0, repairing: 0, completed: 0 };
    for (const row of rows) counts[toApiStatus(row.status)] = row.count;
    return {
      ...counts,
      totalCount: rows.reduce((total, row) => total + row.count, 0),
    };
  }

  async createRequest(userId: string, dto: CreateWarrantyRequestDto) {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        // Lock the unit before checking existing tickets, including serial edits.
        const unit = await manager.getRepository(WarrantyProduct).findOne({
          where: { id: dto.productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!unit) throw new NotFoundException('Warranty product not found');
        const item = await manager.getRepository(OrderItem).findOne({
          where: { id: unit.orderItemId },
          relations: { order: true },
        });
        if (!item || item.order.userId !== userId)
          throw new NotFoundException('Warranty product not found');
        if (item.order.status !== OrderStatus.DONE)
          throw new ConflictException('Order has not been delivered');
        if (coverageStatus(unit) !== 'active')
          throw new ConflictException(
            'Product is not within its warranty period',
          );
        const repository = manager.getRepository(WarrantyTicket);
        const active = await repository
          .createQueryBuilder('ticket')
          .where('ticket.warrantyProductId = :id', { id: unit.id })
          .andWhere('ticket.status != :completed', {
            completed: WarrantyStatus.COMPLETED,
          })
          .getExists();
        if (active)
          throw new ConflictException(
            'Product already has an active warranty request',
          );
        const ticket = await repository.save(
          repository.create({
            warrantyProductId: unit.id,
            productId: item.productId,
            userId,
            orderCode: item.order.orderCode,
            serialNumber: unit.serialNumber,
            contactName: dto.contactName,
            contactPhone: dto.phone,
            issueDescription: dto.description,
            techNotes: null,
            status: WarrantyStatus.RECEIVED,
          }),
        );
        await manager.getRepository(WarrantyEvent).save({
          ticketId: ticket.id,
          status: ticket.status,
          note: 'Đã ghi nhận yêu cầu bảo hành.',
        });
        return ticket.id;
      });
      return this.findRequest(id, userId);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'Product already has an active warranty request',
        );
      throw error;
    }
  }

  async updateRequest(id: string, dto: UpdateWarrantyRequestDto) {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WarrantyTicket);
      const ticket = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!ticket) throw new NotFoundException('Warranty request not found');
      const target = toDatabaseStatus(dto.status);
      const from = WARRANTY_STATUS_FLOW.indexOf(ticket.status);
      const to = WARRANTY_STATUS_FLOW.indexOf(target);
      if (
        ticket.status === WarrantyStatus.COMPLETED ||
        to < from ||
        to > from + 1
      ) {
        throw new ConflictException(
          'Only the current or next status is allowed; completed requests are final',
        );
      }
      ticket.status = target;
      ticket.techNotes = dto.note;
      await repository.save(ticket);
      await manager
        .getRepository(WarrantyEvent)
        .save({ ticketId: id, status: target, note: dto.note });
    });
    return this.findRequest(id);
  }

  private productBuilder() {
    return this.productRepository
      .createQueryBuilder('unit')
      .innerJoinAndSelect('unit.orderItem', 'item')
      .innerJoinAndSelect('item.product', 'product')
      .innerJoinAndSelect('item.order', 'order')
      .leftJoinAndSelect(
        'unit.tickets',
        'activeTicket',
        'activeTicket.status != :completed',
        { completed: WarrantyStatus.COMPLETED },
      );
  }

  private ticketBuilder() {
    return this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.product', 'product')
      .leftJoinAndSelect('ticket.warrantyProduct', 'unit')
      .leftJoinAndSelect('ticket.events', 'event');
  }

  private productView(unit: WarrantyProduct, admin: boolean) {
    const coverage = coverageStatus(unit);
    const activeRequest = unit.tickets?.find(
      (ticket) => ticket.status !== WarrantyStatus.COMPLETED,
    );
    return {
      id: unit.id,
      catalogProductId: unit.orderItem.productId,
      orderItemId: unit.orderItemId,
      unitNumber: unit.unitNumber,
      name: unit.orderItem.product.name,
      serial: unit.serialNumber,
      orderCode: unit.orderItem.order.orderCode,
      purchasedAt: unit.purchasedAt,
      expiresAt: unit.expiresAt,
      warrantyMonths: unit.warrantyMonths,
      coverageStatus: coverage,
      canRequest: coverage === 'active' && !activeRequest,
      activeRequestId: activeRequest?.id ?? null,
      ...(admin ? { ownerId: unit.orderItem.order.userId } : {}),
    };
  }

  private ticketView(ticket: WarrantyTicket, admin: boolean) {
    const unit = ticket.warrantyProduct;
    return {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      productId: ticket.warrantyProductId,
      catalogProductId: ticket.productId,
      contactName: ticket.contactName,
      phone: ticket.contactPhone,
      description: ticket.issueDescription,
      status: toApiStatus(ticket.status),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      product: {
        id: ticket.warrantyProductId,
        catalogProductId: ticket.productId,
        name: ticket.product.name,
        serial: ticket.serialNumber,
        orderCode: ticket.orderCode,
        purchasedAt: unit?.purchasedAt ?? null,
        expiresAt: unit?.expiresAt ?? null,
        warrantyMonths: unit?.warrantyMonths ?? null,
      },
      timeline: [...(ticket.events ?? [])]
        .sort((a, b) => a.id - b.id)
        .map((event) => ({
          status: toApiStatus(event.status),
          date: event.createdAt,
          note: event.note,
        })),
      ...(admin ? { ownerId: ticket.userId } : {}),
    };
  }

  private page<T>(items: T[], totalCount: number, query: WarrantyQueryDto) {
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

  private searchPattern(value: string): string {
    // Treat LIKE wildcards as literal characters in a user-entered search.
    return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
  }
}
