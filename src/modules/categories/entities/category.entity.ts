import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { CategoryParent } from './category-parent.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('categories')
@Unique('UQ_categories_parent_name', ['parentId', 'name'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl!: string | null;

  @Column('uuid')
  parentId!: string;

  @ManyToOne(() => CategoryParent, (parent) => parent.categories, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'parentId',
    foreignKeyConstraintName: 'FK_categories_parent',
  })
  parent!: CategoryParent;

  @OneToMany(() => Product, (product) => product.category)
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
