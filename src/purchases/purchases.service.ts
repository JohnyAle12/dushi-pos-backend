import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Purchase } from './entities/purchase.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
  ) {}

  async create(createPurchaseDto: CreatePurchaseDto): Promise<Purchase> {
    const purchase = this.purchasesRepository.create(createPurchaseDto);
    return this.purchasesRepository.save(purchase);
  }

  async findAll(): Promise<Purchase[]> {
    return this.purchasesRepository.find();
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchasesRepository.findOneBy({ id });
    if (!purchase) {
      throw new NotFoundException(`Purchase with id "${id}" not found`);
    }
    return purchase;
  }

  async update(
    id: string,
    updatePurchaseDto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    const purchase = await this.findOne(id);
    Object.assign(purchase, updatePurchaseDto);
    return this.purchasesRepository.save(purchase);
  }

  async remove(id: string): Promise<void> {
    const purchase = await this.findOne(id);
    await this.purchasesRepository.softRemove(purchase);
  }
}
