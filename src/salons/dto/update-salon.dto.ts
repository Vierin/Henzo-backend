import {
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  IsArray,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { InputJsonValue } from '@prisma/client/runtime/library';

export class UpdateSalonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsBoolean()
  autoConfirmBookings?: boolean;
}
