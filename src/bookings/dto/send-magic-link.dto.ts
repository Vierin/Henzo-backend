import { IsEmail, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBookingDto } from './create-booking.dto';

export class SendMagicLinkDto {
  @IsEmail()
  email: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateBookingDto)
  bookingData: CreateBookingDto;
}

