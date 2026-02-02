import { IsString, IsOptional, IsDateString, IsEmail } from 'class-validator';

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

  // Fields for owner creating booking on behalf of client
  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;
}
