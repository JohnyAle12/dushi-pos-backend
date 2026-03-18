import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { User } from '../../users/entities/user.entity';
import { SaleItem } from './sale-item.entity';

@Entity('sales')
@Unique('UQ_sale_number_per_prefix', ['prefix', 'number'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  tax: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'prefix', length: 20, default: 'FV' })
  prefix: string;

  @Column({ name: 'number', type: 'int', nullable: true })
  number: number | null;

  @Column({
    name: 'amount_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  amountPaid: number | null;

  @Column({
    name: 'change_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  change: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SaleItem, (item) => item.sale, {
    cascade: true,
  })
  items: SaleItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
