import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { WarrantyProduct } from './warranty-product.entity';
import { WarrantyEvent } from './warranty-event.entity';
import { WarrantyStatus } from '../enums/warranty-status.enum';
export { WarrantyStatus } from '../enums/warranty-status.enum';

@Entity('warranty_tickets')
@Unique('UQ_warranty_ticket_code', ['ticketCode'])
@Index('IDX_warranty_product', ['productId'])
@Index('IDX_warranty_user', ['userId'])
@Index('IDX_warranty_order', ['orderCode'])
@Index('UQ_warranty_active_unit', ['warrantyProductId'], {
  unique: true,
  where: `"warrantyProductId" IS NOT NULL AND "status" <> 'COMPLETED'`,
})
export class WarrantyTicket {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_warranty_tickets',
  })
  id!: string;

  @Column({ length: 39, default: () => "('BH-'|| (uuid_generate_v4()))" })
  ticketCode!: string;

  // Nullable only for tickets created before the warranty API was introduced.
  @Column({ type: 'uuid', nullable: true })
  warrantyProductId!: string | null;

  @ManyToOne(() => WarrantyProduct, (product) => product.tickets, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'warrantyProductId',
    foreignKeyConstraintName: 'FK_warranty_ticket_unit',
  })
  warrantyProduct!: WarrantyProduct | null;

  @OneToMany(() => WarrantyEvent, (event) => event.ticket)
  events!: WarrantyEvent[];

  @Column('uuid')
  productId!: string;

  @ManyToOne(() => Product, (product) => product.warrantyTickets, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_warranty_product',
  })
  product!: Product;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.warrantyTickets, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_warranty_user' })
  user!: User | null;

  @Column({ type: 'varchar', length: 39, nullable: true })
  orderCode!: string | null;

  @ManyToOne(() => Order, (order) => order.warrantyTickets, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'orderCode',
    referencedColumnName: 'orderCode',
    foreignKeyConstraintName: 'FK_warranty_order',
  })
  order!: Order | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  serialNumber!: string | null;

  @Column({ length: 200 })
  contactName!: string;

  @Column({ length: 30 })
  contactPhone!: string;

  @Column({ type: 'text' })
  issueDescription!: string;

  @Column({ type: 'text', nullable: true })
  techNotes!: string | null;

  @Column({
    type: 'enum',
    enum: WarrantyStatus,
    enumName: 'warranty_status_enum',
    default: WarrantyStatus.RECEIVED,
  })
  status!: WarrantyStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
