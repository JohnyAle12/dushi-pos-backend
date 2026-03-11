import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdentificationType } from '../../common/enums/identification-type.enum';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    name: 'identification_type',
    type: 'enum',
    enum: IdentificationType,
  })
  identificationType: IdentificationType;

  @Column({ name: 'identification_number', unique: true, length: 50 })
  identificationNumber: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
