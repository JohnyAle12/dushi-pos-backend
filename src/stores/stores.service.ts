import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Store } from './entities/store.entity';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    await this.checkUnique(createStoreDto.identification, createStoreDto.email);

    const store = this.storesRepository.create(createStoreDto);
    return this.storesRepository.save(store);
  }

  async findAll(): Promise<Store[]> {
    return this.storesRepository.find();
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.storesRepository.findOneBy({ id });
    if (!store) {
      throw new NotFoundException(`Store with id "${id}" not found`);
    }
    return store;
  }

  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    const store = await this.findOne(id);

    if (updateStoreDto.identification || updateStoreDto.email) {
      await this.checkUnique(
        updateStoreDto.identification,
        updateStoreDto.email,
        id,
      );
    }

    Object.assign(store, updateStoreDto);
    return this.storesRepository.save(store);
  }

  async remove(id: string): Promise<void> {
    const store = await this.findOne(id);
    await this.storesRepository.remove(store);
  }

  private async checkUnique(
    identification?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    if (identification) {
      const byIdent = await this.storesRepository.findOneBy({ identification });
      if (byIdent && byIdent.id !== excludeId) {
        throw new ConflictException(
          `A store with identification "${identification}" already exists`,
        );
      }
    }

    if (email) {
      const byEmail = await this.storesRepository.findOneBy({ email });
      if (byEmail && byEmail.id !== excludeId) {
        throw new ConflictException(
          `A store with email "${email}" already exists`,
        );
      }
    }
  }
}
