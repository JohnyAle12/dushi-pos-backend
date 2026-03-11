import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 50 })
  identification: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  address: string;

  @Column({ length: 100 })
  city: string;

  @OneToMany(() => User, (user) => user.store)
  users: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
