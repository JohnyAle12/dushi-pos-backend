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

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.softRemove(product);
  }

  async updateStock(
    productId: string,
    updateStockDto: UpdateStockDto,
  ): Promise<{ product: Product; transaction: StockTransaction }> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneBy(Product, { id: productId });
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

  async findTransactions(productId: string): Promise<StockTransaction[]> {
    await this.findOne(productId);
    return this.stockTransactionsRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async restore(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    if (!product.deletedAt) {
      throw new ConflictException('Product is not deleted');
    }
    await this.productsRepository.restore(id);
    return this.findOne(id);
  }
}
