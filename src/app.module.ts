import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseTimezoneService } from './database-timezone.service';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { SeedModule } from './seed/seed.module';
import { StoresModule } from './stores/stores.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', 'root'),
        database: config.get<string>('DB_NAME', 'dushi_pos'),
        autoLoadEntities: true,
        synchronize: true,
        // Offset numérico para MySQL; también se usa TZ en main.ts para Node
        timezone: 'Z', // UTC 0
      }),
    }),
    StoresModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    PurchasesModule,
    SalesModule,
    AuthModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseTimezoneService],
})
export class AppModule {}
