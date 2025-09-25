import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AuthService } from '../auth/auth.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async createBooking(
    @Body() data: CreateBookingDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📅 Received booking request:', {
        hasAuthHeader: !!authHeader,
        serviceId: data.serviceId,
        salonId: data.salonId,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated for booking:', currentUser.user.email);

      const booking = await this.bookingsService.createBooking(
        data,
        currentUser.user.id,
      );

      console.log('✅ Booking created successfully:', booking.id);
      return {
        success: true,
        booking,
      };
    } catch (error) {
      console.error('❌ Create booking failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to create booking',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('user')
  async getUserBookings(@Headers('authorization') authHeader: string) {
    try {
      console.log('📅 Fetching user bookings:', {
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching bookings:',
        currentUser.user.email,
      );

      const bookings = await this.bookingsService.getUserBookings(
        currentUser.user.id,
      );

      console.log('✅ User bookings fetched successfully:', bookings.length);
      return {
        success: true,
        bookings,
      };
    } catch (error) {
      console.error('❌ Fetch user bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch user bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('salon/:salonId')
  async getSalonBookings(
    @Headers('authorization') authHeader: string,
    @Body('salonId') salonId: string,
  ) {
    try {
      console.log('📅 Fetching salon bookings:', {
        hasAuthHeader: !!authHeader,
        salonId,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching salon bookings:',
        currentUser.user.email,
      );

      const bookings = await this.bookingsService.getSalonBookings(salonId);

      console.log('✅ Salon bookings fetched successfully:', bookings.length);
      return {
        success: true,
        bookings,
      };
    } catch (error) {
      console.error('❌ Fetch salon bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch salon bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
