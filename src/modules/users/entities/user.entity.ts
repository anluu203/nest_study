import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { UserRole } from '../../../core/constants/user-role.enum';
import { Order } from '../../orders/entities/order.entity';

@Entity('user')
@Unique('UQ_user_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  username!: string;

  @Column({ length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatarUrl!: string | null;

  @Column({ select: false })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.USER,
  })
  role!: UserRole;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];
}
