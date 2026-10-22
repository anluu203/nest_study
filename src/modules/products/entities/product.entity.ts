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
import { Category } from '../../categories/entities/category.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Review } from '../../reviews/entities/review.entity';
import { WarrantyTicket } from '../../warranties/entities/warranty-ticket.entity';
import { ProductRecommendation } from '../../recommendations/entities/product-recommendation.entity';

@Entity('products')
@Index('IDX_products_category_active', ['categoryId', 'isActive'])
@Check('CHK_products_price_positive', '"price" > 0')
@Unique('UQ_products_sku', ['sku'])
@Check(
  'CHK_products_discount',
  '"discountPrice" >= 0 AND "discountPrice" <= "price"',
)
@Check('CHK_products_stock', '"stockQuantity" >= 0')
@Check('CHK_products_warranty', '"warrantyMonths" >= 0')
@Check('CHK_products_images_array', `jsonb_typeof("images") = 'array'`)
@Check('CHK_products_specs_object', `jsonb_typeof("specifications") = 'object'`)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'bigint' })
  price!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: 'bigint', nullable: true })
  discountPrice!: string | null;

  @Column({ type: 'integer', nullable: true })
  stockQuantity!: number | null;

  @Column({ type: 'jsonb', default: [] })
  images!: string[];

  @Column({ type: 'integer', nullable: true })
  warrantyMonths!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  specifications!: Record<string, unknown> | null;

  @Column('uuid')
  categoryId!: string;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'categoryId',
    foreignKeyConstraintName: 'FK_products_category',
  })
  category!: Category;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems!: OrderItem[];

  @OneToMany(() => Review, (review) => review.product)
  reviews!: Review[];

  @OneToMany(() => WarrantyTicket, (ticket) => ticket.product)
  warrantyTickets!: WarrantyTicket[];

  @OneToMany(
    () => ProductRecommendation,
    (recommendation) => recommendation.product,
  )
  recommendations!: ProductRecommendation[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
