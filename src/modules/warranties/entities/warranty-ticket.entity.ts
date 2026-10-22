import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';

export enum WarrantyStatus {
  RECEIVED = 'RECEIVED',
  CHECKING = 'CHECKING',
  REPAIRING = 'REPAIRING',
  COMPLETED = 'COMPLETED',
}

@Entity('warranty_tickets')
@Unique('UQ_warranty_ticket_code', ['ticketCode'])
@Index('IDX_warranty_product', ['productId'])
@Index('IDX_warranty_user', ['userId'])
@Index('IDX_warranty_order', ['orderCode'])
export class WarrantyTicket {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_warranty_tickets',
  })
  id!: string;

  @Column({ length: 39, default: () => "('BH-'|| (uuid_generate_v4()))" })
  ticketCode!: string;

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
