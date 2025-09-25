import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsDateString()
  time: string;

  @IsString()
  salonId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
