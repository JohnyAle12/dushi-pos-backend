import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { IdentificationType } from '../../common/enums/identification-type.enum';

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(IdentificationType)
  @IsOptional()
  identificationType?: IdentificationType;

  @IsString()
  @IsOptional()
  identificationNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
