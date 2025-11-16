import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Optional localized fields
  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameVi?: string;

  @IsOptional()
  @IsString()
  nameRu?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionVi?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsNumber()
  @IsPositive()
  duration: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  salonId: string;

  @IsOptional()
  @IsInt()
  serviceCategoryId?: number;

  @IsOptional()
  @IsString()
  serviceGroupId?: string;
}
