import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { WarrantyTicket } from '../../warranties/entities/warranty-ticket.entity';
import { OrderPaymentMethod } from '../enums/order-payment-method.enum';

@Entity('orders')
@Index('IDX_orders_user_status_created', ['userId', 'status', 'createdAt'])
@Index('UQ_orders_active_cart', ['userId'], {
  unique: true,
  where: `"status" = 'AddingItem'`,
})
@Check('CHK_orders_total_nonnegative', '"totalPrice" >= 0')
@Unique('UQ_orders_code', ['orderCode'])
@Check('CHK_orders_payment_method', `"paymentMethod" IN ('COD', 'VNPAY')`)
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 39, default: () => "('DH-'|| (uuid_generate_v4()))" })
  orderCode!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  shippingName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  shippingPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingAddress!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentMethod!: OrderPaymentMethod | null;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_orders_user',
  })
  user!: User;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status_enum',
    default: OrderStatus.ADDING_ITEM,
  })
  status!: OrderStatus;

  @Column({ type: 'bigint', default: '0' })
  totalPrice!: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: false })
  items!: OrderItem[];

  @OneToMany(() => WarrantyTicket, (ticket) => ticket.order)
  warrantyTickets!: WarrantyTicket[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
