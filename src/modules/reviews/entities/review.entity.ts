import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('reviews')
@Index('IDX_reviews_user', ['userId'])
@Index('IDX_reviews_product', ['productId'])
@Check('CHK_reviews_rating', '"rating" BETWEEN 1 AND 5')
export class Review {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_reviews' })
  id!: string;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_reviews_user' })
  user!: User;

  @Column('uuid')
  productId!: string;

  @ManyToOne(() => Product, (product) => product.reviews, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_reviews_product',
  })
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
