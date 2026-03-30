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
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body() createCustomerDto: CreateCustomerDto,
  ) {
    return this.customersService.create(createCustomerDto, req.user.storeId);
  }

  @Get()
  findAll(@Req() req: { user: AuthUser }) {
    return this.customersService.findAll(req.user.storeId);
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.customersService.findOne(id, req.user.storeId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(
      id,
      req.user.storeId,
      updateCustomerDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.customersService.remove(id, req.user.storeId);
  }

  @Patch(':id/restore')
  restore(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.customersService.restore(id, req.user.storeId);
  }
}
