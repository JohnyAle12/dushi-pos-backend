import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(createProductDto, req.user.storeId);
  }

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query('trackInventory') trackInventory?: string,
  ) {
    const filter =
      trackInventory !== undefined ? trackInventory === 'true' : undefined;
    return this.productsService.findAll(req.user.storeId, filter);
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.productsService.findOne(id, req.user.storeId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.user.storeId, updateProductDto);
  }

  @Patch(':id/stock')
  updateStock(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    return this.productsService.updateStock(
      id,
      req.user.storeId,
      updateStockDto,
    );
  }

  @Get(':id/transactions')
  findTransactions(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.productsService.findTransactions(id, req.user.storeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.productsService.remove(id, req.user.storeId);
  }

  @Patch(':id/restore')
  restore(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.productsService.restore(id, req.user.storeId);
  }
}
