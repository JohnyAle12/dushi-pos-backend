import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
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
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createSaleDto: CreateSaleDto): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      for (const item of createSaleDto.items) {
        const product = await manager.findOneBy(Product, {
          id: item.productId,
        });
        if (!product) {
          throw new NotFoundException(
            `Product with id "${item.productId}" not found`,
          );
        }
        product.stock -= item.quantity;
        await manager.save(product);
      }

      const sale = manager.create(Sale, createSaleDto);
      return manager.save(sale);
    });
  }

  async findAll(): Promise<Sale[]> {
    return this.salesRepository.find({ relations: ['user'] });
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['user'],
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

    if (updateSaleDto.subtotal !== undefined) sale.subtotal = updateSaleDto.subtotal;
    if (updateSaleDto.tax !== undefined) sale.tax = updateSaleDto.tax;
    if (updateSaleDto.total !== undefined) sale.total = updateSaleDto.total;
    if (updateSaleDto.paymentMethod) sale.paymentMethod = updateSaleDto.paymentMethod;
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
