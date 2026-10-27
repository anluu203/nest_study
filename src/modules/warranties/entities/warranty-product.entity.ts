import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { WarrantyTicket } from './warranty-ticket.entity';

/** One physical unit from a delivered order, rather than a catalog product. */
@Entity('warranty_products')
@Unique('UQ_warranty_products_unit', ['orderItemId', 'unitNumber'])
@Unique('UQ_warranty_products_serial', ['serialNumber'])
@Check('CHK_warranty_products_unit', '"unitNumber" > 0')
@Check('CHK_warranty_products_months', '"warrantyMonths" >= 0')
@Check('CHK_warranty_products_dates', '"expiresAt" >= "purchasedAt"')
export class WarrantyProduct {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_warranty_products',
  })
  id!: string;

  @Column('uuid')
  orderItemId!: string;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'orderItemId',
    foreignKeyConstraintName: 'FK_warranty_products_item',
  })
  orderItem!: OrderItem;

  @Column('integer')
  unitNumber!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'date' })
  purchasedAt!: string;

  @Column({ type: 'integer', nullable: true })
  warrantyMonths!: number | null;

  @Column({ type: 'date', nullable: true })
  expiresAt!: string | null;

  @OneToMany(() => WarrantyTicket, (ticket) => ticket.warrantyProduct)
  tickets!: WarrantyTicket[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
