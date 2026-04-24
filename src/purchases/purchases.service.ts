import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
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

    const where: Record<string, unknown> = { storeId };

    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    } else if (startDate) {
      where.date = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.date = LessThanOrEqual(endDate);
    }

    const [data, total] = await this.purchasesRepository.findAndCount({
      where,
      order: { date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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
