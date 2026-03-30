import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StockMovementType } from '../common/enums/stock-movement-type.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Product } from './entities/product.entity';
import { StockTransaction } from './entities/stock-transaction.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionsRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    storeId: string,
  ): Promise<Product> {
    const product = this.productsRepository.create({
      ...createProductDto,
      storeId,
    });
    return this.productsRepository.save(product);
  }

  async findAll(storeId: string, trackInventory?: boolean): Promise<Product[]> {
    const where: Record<string, unknown> = { storeId };
    if (trackInventory !== undefined) {
      where.trackInventory = trackInventory;
    }
    return this.productsRepository.find({ where });
  }

  async findOne(id: string, storeId: string): Promise<Product> {
    const product = await this.productsRepository.findOneBy({ id, storeId });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  async update(
    id: string,
    storeId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id, storeId);
    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: string, storeId: string): Promise<void> {
    const product = await this.findOne(id, storeId);
    await this.productsRepository.softRemove(product);
  }

  async updateStock(
    productId: string,
    storeId: string,
    updateStockDto: UpdateStockDto,
  ): Promise<{ product: Product; transaction: StockTransaction }> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: productId, storeId },
      });
      if (!product) {
        throw new NotFoundException(`Product with id "${productId}" not found`);
      }

      const previousStock = product.stock;
      let newStock: number;

      switch (updateStockDto.type) {
        case StockMovementType.IN:
          newStock = previousStock + updateStockDto.quantity;
          break;
        case StockMovementType.OUT:
          newStock = previousStock - updateStockDto.quantity;
          if (newStock < 0) {
            throw new BadRequestException(
              `Insufficient stock. Current: ${previousStock}, requested: ${updateStockDto.quantity}`,
            );
          }
          break;
        case StockMovementType.ADJUSTMENT:
          newStock = updateStockDto.quantity;
          break;
      }

      product.stock = newStock;
      await manager.save(Product, product);

      const transaction = manager.create(StockTransaction, {
        productId,
        type: updateStockDto.type,
        quantity: updateStockDto.quantity,
        previousStock,
        newStock,
        reason: updateStockDto.reason,
      });
      await manager.save(StockTransaction, transaction);

      return { product, transaction };
    });
  }

  async findTransactions(
    productId: string,
    storeId: string,
  ): Promise<StockTransaction[]> {
    await this.findOne(productId, storeId);
    return this.stockTransactionsRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async restore(id: string, storeId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, storeId },
      withDeleted: true,
    });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    if (!product.deletedAt) {
      throw new ConflictException('Product is not deleted');
    }
    await this.productsRepository.restore(id);
    return this.findOne(id, storeId);
  }
}
