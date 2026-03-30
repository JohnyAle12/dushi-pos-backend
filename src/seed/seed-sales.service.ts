import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';
import { CreateSaleItemDto } from '../sales/dto/create-sale-item.dto';
import { SalesService } from '../sales/sales.service';

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.NEQUI,
  PaymentMethod.DAVIPLATA,
  PaymentMethod.BANCOLOMBIA,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

@Injectable()
export class SeedSalesService {
  constructor(
    private readonly salesService: SalesService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async run(count = 30): Promise<void> {
    const users = await this.usersRepository.find({
      select: ['id', 'storeId'],
    });

    if (users.length === 0) {
      throw new Error('No users found. Create users first.');
    }

    for (let i = 0; i < count; i++) {
      const user = pick(users);
      const products = await this.productsRepository.find({
        where: { storeId: user.storeId },
        select: ['id', 'price'],
      });

      if (products.length === 0) {
        throw new Error(
          'No products found for the selected user store. Create products for that store first.',
        );
      }

      const numItems = randomInt(1, 4);
      const selectedProducts: { product: Product; quantity: number }[] = [];
      const usedIds = new Set<string>();

      for (let j = 0; j < numItems; j++) {
        const product = pick(products);
        if (usedIds.has(product.id)) continue;
        usedIds.add(product.id);
        selectedProducts.push({
          product,
          quantity: randomInt(1, 5),
        });
      }

      if (selectedProducts.length === 0) {
        selectedProducts.push({
          product: pick(products),
          quantity: randomInt(1, 5),
        });
      }

      let subtotal = 0;
      const items: CreateSaleItemDto[] = selectedProducts.map(
        ({ product, quantity }) => {
          const total = Number(product.price) * quantity;
          subtotal += total;
          return {
            productId: product.id,
            quantity,
            total,
          };
        },
      );

      const tax = Math.round(subtotal * 0.19 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      const createSaleDto: CreateSaleDto = {
        subtotal,
        tax,
        total,
        paymentMethod: pick(PAYMENT_METHODS),
        prefix: 'FV',
        items,
      };

      const auth: AuthUser = {
        id: user.id,
        storeId: user.storeId,
        name: '',
        email: '',
        role: '',
      };
      await this.salesService.create(createSaleDto, auth);
    }
  }
}
