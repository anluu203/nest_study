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
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index('IDX_orders_user_status_created', ['userId', 'status', 'createdAt'])
@Index('UQ_orders_active_cart', ['userId'], {
  unique: true,
  where: `"status" = 'AddingItem'`,
})
@Check('CHK_orders_total_nonnegative', '"totalPrice" >= 0')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
