import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  duration: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  salonId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
