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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesService } from './purchases.service';

@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body() createPurchaseDto: CreatePurchaseDto,
  ) {
    return this.purchasesService.create(createPurchaseDto, req.user.storeId);
  }

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.purchasesService.findAll(
      req.user.storeId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.purchasesService.findOne(id, req.user.storeId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchasesService.update(
      id,
      req.user.storeId,
      updatePurchaseDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.purchasesService.remove(id, req.user.storeId);
  }
}
