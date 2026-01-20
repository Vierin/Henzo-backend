import {
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  IsArray,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { InputJsonValue } from '@prisma/client/runtime/library';

export class CreateSalonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Description must be 250 characters or less' })
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  workingHours?: InputJsonValue;

  @IsOptional()
  reminderSettings?: InputJsonValue;

  // categoryIds removed: categories are derived from services
}
