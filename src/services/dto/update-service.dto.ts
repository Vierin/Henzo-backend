import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsNumber()
  @IsPositive()
  duration?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsInt()
  serviceCategoryId?: number;
}
