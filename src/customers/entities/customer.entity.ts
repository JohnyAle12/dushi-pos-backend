import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { IdentificationType } from '../../common/enums/identification-type.enum';
import { Store } from '../../stores/entities/store.entity';

@Entity('customers')
@Unique('UQ_customer_ident_store', ['storeId', 'identificationNumber'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ length: 150 })
  name: string;

  @Column({
    name: 'identification_type',
    type: 'enum',
    enum: IdentificationType,
  })
  identificationType: IdentificationType;

  @Column({ name: 'identification_number', length: 50 })
  identificationNumber: string;

  @Column({ length: 255, nullable: true })
  email?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
