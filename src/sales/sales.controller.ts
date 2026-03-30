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
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto, req.user);
  }

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.salesService.findAll(
      req.user.storeId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      startDate,
      endDate,
      paymentMethod,
    );
  }

  @Get('totals')
  getTotals(
    @Req() req: { user: AuthUser },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: 'day' | 'month',
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.salesService.getTotals(
      req.user.storeId,
      startDate,
      endDate,
      groupBy === 'month' ? 'month' : 'day',
      paymentMethod,
    );
  }

  @Get('by-product')
  getSalesByProduct(
    @Req() req: { user: AuthUser },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.salesService.getSalesByProduct(
      req.user.storeId,
      startDate,
      endDate,
      paymentMethod,
    );
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.salesService.findOne(id, req.user.storeId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
  ) {
    return this.salesService.update(id, req.user.storeId, updateSaleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.salesService.remove(id, req.user.storeId);
  }

  @Patch(':id/restore')
  restore(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.salesService.restore(id, req.user.storeId);
  }
}
