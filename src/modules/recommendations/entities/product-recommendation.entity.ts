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
import { Product } from '../../products/entities/product.entity';

export type TargetUse = 'OFFICE' | 'GAMING' | 'DESIGN';

@Entity('product_recommendations')
@Index('IDX_recommendations_product', ['productId'])
@Index('IDX_recommendations_visible_category', ['isVisible', 'categoryType'])
@Check('CHK_recommendations_price', '"referencePrice" >= 0')
@Check(
  'CHK_recommendations_uses',
  `jsonb_typeof("targetUses") = 'array' AND "targetUses" <@ '["OFFICE","GAMING","DESIGN"]'::jsonb`,
)
@Check('CHK_recommendations_specs', `jsonb_typeof("keySpecs") = 'object'`)
@Check(
  'CHK_recommendations_reasoning',
  `jsonb_typeof("reasoningMap") = 'object'`,
)
export class ProductRecommendation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_product_recommendations',
  })
  id!: string;

  @Column({ length: 200 })
  productName!: string;

  @Column({ length: 50 })
  categoryType!: string;

  @Column({ type: 'bigint' })
  referencePrice!: string;

  @Column({ type: 'jsonb', default: [] })
  targetUses!: TargetUse[];

  @Column({ type: 'jsonb', default: {} })
  keySpecs!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  reasoningMap!: Partial<Record<TargetUse, string>>;

  @Column({ default: true })
  isVisible!: boolean;

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @ManyToOne(() => Product, (product) => product.recommendations, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_recommendations_product',
  })
  product!: Product | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
