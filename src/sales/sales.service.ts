import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { StockMovementType } from '../common/enums/stock-movement-type.enum';
import { Product } from '../products/entities/product.entity';
import { StockTransaction } from '../products/entities/stock-transaction.entity';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleItem } from './entities/sale-item.entity';
import { Sale } from './entities/sale.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepository: Repository<SaleItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createSaleDto: CreateSaleDto): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const prefix = createSaleDto.prefix?.trim() || 'FV';

      const { max } = (await manager
        .getRepository(Sale)
        .createQueryBuilder('sale')
        .where('sale.prefix = :prefix', { prefix })
        .select('MAX(sale.number)', 'max')
        .getRawOne<{ max: string | null }>()) ?? { max: null };

      const nextNumber = (max ? Number(max) : 0) + 1;

      for (const item of createSaleDto.items) {
        const product = await manager.findOneBy(Product, {
          id: item.productId,
        });
        if (!product) {
          throw new NotFoundException(
            `Product with id "${item.productId}" not found`,
          );
        }
        if (product.trackInventory) {
          const previousStock = product.stock;
          const newStock = previousStock - item.quantity;

          // if (newStock < 0) {
          //   throw new BadRequestException(
          //     `Insufficient stock for "${product.name}". Current: ${previousStock}, requested: ${item.quantity}`,
          //   );
          // }

          product.stock = newStock;
          await manager.save(Product, product);

          const transaction = manager.create(StockTransaction, {
            productId: product.id,
            type: StockMovementType.OUT,
            quantity: item.quantity,
            previousStock,
            newStock,
            reason: `Venta`,
          });
          await manager.save(StockTransaction, transaction);
        }
      }

      const sale = manager.create(Sale, {
        ...createSaleDto,
        prefix,
        number: nextNumber,
      });
      return manager.save(sale);
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<{
    data: Sale[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const where: any = {};
    if (startDate && endDate) {
      if (startDate > endDate) {
        throw new BadRequestException(
          'startDate must be before or equal to endDate',
        );
      }
      where.createdAt = Between(
        `${startDate}T00:00:00.000Z`,
        `${endDate}T23:59:59.999Z`,
      );
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(`${startDate}T00:00:00.000Z`);
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(`${endDate}T23:59:59.999Z`);
    }

    if (paymentMethod) {
      const validMethods = Object.values(PaymentMethod);
      if (!validMethods.includes(paymentMethod as PaymentMethod)) {
        throw new BadRequestException(
          `paymentMethod must be one of: ${validMethods.join(', ')}`,
        );
      }
      where.paymentMethod = paymentMethod;
    }

    const [sales, total] = await this.salesRepository.findAndCount({
      where: Object.keys(where).length ? where : undefined,
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = sales.map((sale) => ({
      ...sale,
      items: sale.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        total: item.total,
        product: item.product
          ? {
              name: item.product.name,
              price: item.product.price,
              description: item.product.description,
              category: item.product.category,
            }
          : null,
      })),
    })) as Sale[];

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

  async getTotals(
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'month',
    paymentMethod?: string,
  ): Promise<{
    data: { period: string; total: number; count: number }[];
    summary: { total: number; count: number };
  }> {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'startDate and endDate are required (format: YYYY-MM-DD)',
      );
    }
    if (startDate > endDate) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }
    if (paymentMethod) {
      const validMethods = Object.values(PaymentMethod);
      if (!validMethods.includes(paymentMethod as PaymentMethod)) {
        throw new BadRequestException(
          `paymentMethod must be one of: ${validMethods.join(', ')}`,
        );
      }
    }

    const qb = this.salesRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.total)', 'total')
      .addSelect('COUNT(sale.id)', 'count')
      .where('DATE(sale.created_at) >= :startDate', { startDate })
      .andWhere('DATE(sale.created_at) <= :endDate', { endDate });

    if (paymentMethod) {
      qb.andWhere('sale.payment_method = :paymentMethod', { paymentMethod });
    }

    if (groupBy === 'day') {
      qb.addSelect('DATE(sale.created_at)', 'period')
        .groupBy('DATE(sale.created_at)')
        .orderBy('period', 'ASC');
    } else {
      qb.addSelect("DATE_FORMAT(sale.created_at, '%Y-%m')", 'period')
        .groupBy("DATE_FORMAT(sale.created_at, '%Y-%m')")
        .orderBy('period', 'ASC');
    }

    const data = await qb.getRawMany<{
      period: string;
      total: string;
      count: string;
    }>();

    const summaryQb = this.salesRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.total)', 'total')
      .addSelect('COUNT(sale.id)', 'count')
      .where('DATE(sale.created_at) >= :startDate', { startDate })
      .andWhere('DATE(sale.created_at) <= :endDate', { endDate });

    if (paymentMethod) {
      summaryQb.andWhere('sale.payment_method = :paymentMethod', {
        paymentMethod,
      });
    }
    const summaryRow = await summaryQb.getRawOne<{
      total: string | null;
      count: string;
    }>();

    const summary = {
      total: summaryRow?.total ? Number(summaryRow.total) : 0,
      count: summaryRow?.count ? Number(summaryRow.count) : 0,
    };

    return {
      data: data.map((row) => ({
        period: row.period,
        total: Number(row.total),
        count: Number(row.count),
      })),
      summary,
    };
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });
    if (!sale) {
      throw new NotFoundException(`Sale with id "${id}" not found`);
    }
    return sale;
  }

  async update(id: string, updateSaleDto: UpdateSaleDto): Promise<Sale> {
    const sale = await this.findOne(id);

    if (updateSaleDto.items) {
      await this.saleItemsRepository.delete({ saleId: id });

      const newItems = updateSaleDto.items.map((item) =>
        this.saleItemsRepository.create({ ...item, saleId: id }),
      );
      sale.items = newItems;
    }

    if (updateSaleDto.subtotal !== undefined)
      sale.subtotal = updateSaleDto.subtotal;
    if (updateSaleDto.tax !== undefined) sale.tax = updateSaleDto.tax;
    if (updateSaleDto.total !== undefined) sale.total = updateSaleDto.total;
    if (updateSaleDto.paymentMethod)
      sale.paymentMethod = updateSaleDto.paymentMethod;
    if (updateSaleDto.amountPaid !== undefined)
      sale.amountPaid = updateSaleDto.amountPaid;
    if (updateSaleDto.change !== undefined) sale.change = updateSaleDto.change;
    if (updateSaleDto.userId) sale.userId = updateSaleDto.userId;

    return this.salesRepository.save(sale);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);
    await this.salesRepository.softRemove(sale);
  }

  async restore(id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!sale) {
      throw new NotFoundException(`Sale with id "${id}" not found`);
    }
    if (!sale.deletedAt) {
      throw new ConflictException('Sale is not deleted');
    }
    await this.salesRepository.restore(id);
    await this.saleItemsRepository
      .createQueryBuilder()
      .restore()
      .where('sale_id = :id', { id })
      .execute();
    return this.findOne(id);
  }
}
