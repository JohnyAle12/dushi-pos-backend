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

  async create(
    createPurchaseDto: CreatePurchaseDto,
    storeId: string,
  ): Promise<Purchase> {
    const purchase = this.purchasesRepository.create({
      ...createPurchaseDto,
      storeId,
    });
    return this.purchasesRepository.save(purchase);
  }

  async findAll(storeId: string): Promise<Purchase[]> {
    return this.purchasesRepository.find({ where: { storeId } });
  }

  async findOne(id: string, storeId: string): Promise<Purchase> {
    const purchase = await this.purchasesRepository.findOneBy({ id, storeId });
    if (!purchase) {
      throw new NotFoundException(`Purchase with id "${id}" not found`);
    }
    return purchase;
  }

  async update(
    id: string,
    storeId: string,
    updatePurchaseDto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    const purchase = await this.findOne(id, storeId);
    Object.assign(purchase, updatePurchaseDto);
    return this.purchasesRepository.save(purchase);
  }

  async remove(id: string, storeId: string): Promise<void> {
    const purchase = await this.findOne(id, storeId);
    await this.purchasesRepository.softRemove(purchase);
  }
}
