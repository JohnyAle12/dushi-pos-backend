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
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleItem } from './entities/sale-item.entity';
import { Sale } from './entities/sale.entity';

type SaleListItem = {
  id: string;
  productId: string;
  quantity: number;
  total: number;
  product: {
    name: string;
    price: number;
    description: string;
    category: string;
  } | null;
};

type SaleListResponseItem = Omit<Sale, 'items'> & {
  totalAfterDiscount: number;
  items: SaleListItem[];
};

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepository: Repository<SaleItem>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  private calculateTotalAfterDiscount(
    total: number,
    paymentMethod: PaymentMethod,
  ): number {
    const numericTotal = Number(total);

    if (paymentMethod === PaymentMethod.RAPPI) {
      return Number((numericTotal * (1 - 0.216)).toFixed(2));
    }

    if (paymentMethod === PaymentMethod.CARD) {
      return Number(
        (
          numericTotal -
          numericTotal * 0.0329 -
          numericTotal * 0.00414 -
          300
        ).toFixed(2),
      );
    }

    return numericTotal;
  }

  private getTotalAfterDiscountSql(
    totalColumn: string,
    paymentMethodColumn: string,
  ): string {
    return `CASE
      WHEN ${paymentMethodColumn} = '${PaymentMethod.RAPPI}' THEN ${totalColumn} * (1 - 0.216)
      WHEN ${paymentMethodColumn} = '${PaymentMethod.CARD}' THEN ${totalColumn} - (${totalColumn} * 0.00414) - (${totalColumn} * 0.0329 + 300)
      ELSE ${totalColumn}
    END`;
  }

  async create(createSaleDto: CreateSaleDto, auth: AuthUser): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const prefix = createSaleDto.prefix?.trim() || 'FV';

      const { max } = (await manager
        .getRepository(Sale)
        .createQueryBuilder('sale')
        .where('sale.prefix = :prefix', { prefix })
        .andWhere('sale.store_id = :storeId', { storeId: auth.storeId })
        .withDeleted()
        .select('MAX(sale.number)', 'max')
        .getRawOne<{ max: string | null }>()) ?? { max: null };

      const nextNumber = (max ? Number(max) : 0) + 1;

      for (const item of createSaleDto.items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId, storeId: auth.storeId },
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

      if (createSaleDto.customerId) {
        const customer = await manager.findOne(Customer, {
          where: { id: createSaleDto.customerId, storeId: auth.storeId },
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer with id "${createSaleDto.customerId}" not found`,
          );
        }
      }

      const sale = manager.create(Sale, {
        ...createSaleDto,
        prefix,
        number: nextNumber,
        userId: auth.id,
        storeId: auth.storeId,
      });
      return manager.save(sale);
    });
  }

  async findAll(
    storeId: string,
    page = 1,
    limit = 20,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<{
    data: SaleListResponseItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const where: Record<string, unknown> = { storeId };
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
      where,
      relations: ['items', 'items.product', 'customer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = sales.map((sale) => ({
      ...sale,
      totalAfterDiscount: this.calculateTotalAfterDiscount(
        Number(sale.total),
        sale.paymentMethod,
      ),
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
    }));

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
    storeId: string,
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'month',
    paymentMethod?: string,
  ): Promise<{
    data: {
      period: string;
      total: number;
      totalAfterDiscount: number;
      count: number;
    }[];
    summary: { total: number; totalAfterDiscount: number; count: number };
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

    const totalAfterDiscountSql = this.getTotalAfterDiscountSql(
      'sale.total',
      'sale.payment_method',
    );

    const qb = this.salesRepository
      .createQueryBuilder('sale')
      .select(`SUM(${totalAfterDiscountSql})`, 'total')
      .addSelect('SUM(sale.total)', 'totalAfterDiscount')
      .addSelect('COUNT(sale.id)', 'count')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('DATE(sale.created_at) >= :startDate', { startDate })
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
      totalAfterDiscount: string;
      count: string;
    }>();

    const summaryQb = this.salesRepository
      .createQueryBuilder('sale')
      .select(`SUM(${totalAfterDiscountSql})`, 'totalAfterDiscount')
      .addSelect('SUM(sale.total)', 'total')
      .addSelect('COUNT(sale.id)', 'count')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('DATE(sale.created_at) >= :startDate', { startDate })
      .andWhere('DATE(sale.created_at) <= :endDate', { endDate });

    if (paymentMethod) {
      summaryQb.andWhere('sale.payment_method = :paymentMethod', {
        paymentMethod,
      });
    }
    const summaryRow = await summaryQb.getRawOne<{
      total: string | null;
      totalAfterDiscount: string | null;
      count: string;
    }>();

    const summary = {
      total: summaryRow?.total ? Number(summaryRow.total) : 0,
      totalAfterDiscount: summaryRow?.totalAfterDiscount
        ? Number(summaryRow.totalAfterDiscount)
        : 0,
      count: summaryRow?.count ? Number(summaryRow.count) : 0,
    };

    return {
      data: data.map((row) => ({
        period: row.period,
        total: Number(row.total),
        totalAfterDiscount: Number(row.totalAfterDiscount),
        count: Number(row.count),
      })),
      summary,
    };
  }

  async getSalesByProduct(
    storeId: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<{
    data: {
      productId: string;
      productName: string;
      category: string | null;
      quantitySold: number;
      totalAmount: number;
    }[];
  }> {
    if (startDate && endDate && startDate > endDate) {
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

    const qb = this.saleItemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .innerJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('product.category', 'category')
      .addSelect('SUM(item.quantity)', 'quantitySold')
      .addSelect('SUM(item.total)', 'totalAmount')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .groupBy('product.id');

    if (startDate && endDate) {
      qb.andWhere('sale.created_at BETWEEN :start AND :end', {
        start: `${startDate}T00:00:00.000Z`,
        end: `${endDate}T23:59:59.999Z`,
      });
    } else if (startDate) {
      qb.andWhere('sale.created_at >= :start', {
        start: `${startDate}T00:00:00.000Z`,
      });
    } else if (endDate) {
      qb.andWhere('sale.created_at <= :end', {
        end: `${endDate}T23:59:59.999Z`,
      });
    }

    if (paymentMethod) {
      qb.andWhere('sale.payment_method = :paymentMethod', { paymentMethod });
    }

    qb.orderBy('SUM(item.quantity)', 'DESC');

    const rows = await qb.getRawMany<{
      productId: string;
      productName: string;
      category: string | null;
      quantitySold: string;
      totalAmount: string;
    }>();

    return {
      data: rows.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        category: row.category,
        quantitySold: Number(row.quantitySold),
        totalAmount: Number(row.totalAmount),
      })),
    };
  }

  async findOne(id: string, storeId: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id, storeId },
      relations: ['user', 'items', 'customer'],
    });
    if (!sale) {
      throw new NotFoundException(`Sale with id "${id}" not found`);
    }
    return sale;
  }

  async update(
    id: string,
    storeId: string,
    updateSaleDto: UpdateSaleDto,
  ): Promise<Sale> {
    const sale = await this.findOne(id, storeId);

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

    if (updateSaleDto.customerId !== undefined) {
      if (updateSaleDto.customerId === null) {
        sale.customerId = null;
      } else {
        const customer = await this.customersRepository.findOneBy({
          id: updateSaleDto.customerId,
          storeId,
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer with id "${updateSaleDto.customerId}" not found`,
          );
        }
        sale.customerId = updateSaleDto.customerId;
      }
    }

    if (updateSaleDto.userId) {
      const user = await this.usersRepository.findOneBy({
        id: updateSaleDto.userId,
        storeId,
      });
      if (!user) {
        throw new NotFoundException(
          `User with id "${updateSaleDto.userId}" not found`,
        );
      }
      sale.userId = updateSaleDto.userId;
    }

    return this.salesRepository.save(sale);
  }

  async remove(id: string, storeId: string): Promise<void> {
    const sale = await this.findOne(id, storeId);
    await this.salesRepository.softRemove(sale);
  }

  async restore(id: string, storeId: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id, storeId },
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
    return this.findOne(id, storeId);
  }
}
