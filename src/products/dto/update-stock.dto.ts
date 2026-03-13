import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';

export class UpdateStockDto {
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
