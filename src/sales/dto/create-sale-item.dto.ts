import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateSaleItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total: number;
}
