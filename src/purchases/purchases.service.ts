import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
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

  async findAll(
    storeId: string,
    page = 1,
    limit = 10,
    startDate?: string,
    endDate?: string,
    search?: string,
  ): Promise<{
    data: Purchase[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    if (startDate && !this.isValidDateFormat(startDate)) {
      throw new BadRequestException('startDate must use format YYYY-MM-DD');
    }
    if (endDate && !this.isValidDateFormat(endDate)) {
      throw new BadRequestException('endDate must use format YYYY-MM-DD');
    }
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }

    const qb = this.purchasesRepository
      .createQueryBuilder('purchase')
      .where('purchase.storeId = :storeId', { storeId })
      .andWhere('purchase.deletedAt IS NULL')
      .orderBy('purchase.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (startDate && endDate) {
      qb.andWhere('purchase.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('purchase.date >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('purchase.date <= :endDate', { endDate });
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const pattern = `%${trimmedSearch}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('purchase.supplier LIKE :textSearch', {
              textSearch: pattern,
            })
            .orWhere('purchase.observations LIKE :textSearch', {
              textSearch: pattern,
            });
        }),
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  private isValidDateFormat(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
