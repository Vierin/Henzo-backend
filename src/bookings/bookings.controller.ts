import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Query,
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
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const bookings = await this.bookingsService.getUserBookings(
        currentUser.user.id,
      );

      return bookings;
    } catch (error) {
      console.error('❌ Fetch user bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch user bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('user/upcoming')
  async getUpcomingBookings(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const bookings = await this.bookingsService.getUpcomingBookings(
        currentUser.user.id,
      );

      return bookings;
    } catch (error) {
      console.error('❌ Fetch upcoming bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch upcoming bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('user/completed')
  async getCompletedBookings(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const bookings = await this.bookingsService.getCompletedBookings(
        currentUser.user.id,
      );

      return bookings;
    } catch (error) {
      console.error('❌ Fetch completed bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch completed bookings',
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

  @Get()
  async getBookingsByDateAndSalon(
    @Headers('authorization') authHeader: string,
    @Query('salonId') salonId: string,
    @Query('date') date: string,
    @Query('status') status: string = 'CONFIRMED',
  ) {
    try {
      console.log('📅 Fetching bookings by date and salon:', {
        hasAuthHeader: !!authHeader,
        salonId,
        date,
        status,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching bookings:',
        currentUser.user.email,
      );

      const bookings = await this.bookingsService.getBookingsByDateAndSalon(
        salonId,
        date,
        status,
      );

      console.log('✅ Bookings fetched successfully:', bookings.length);
      return bookings;
    } catch (error) {
      console.error('❌ Fetch bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('owner')
  async getOwnerBookings(@Headers('authorization') authHeader: string) {
    try {
      console.log('📅 Fetching owner bookings:', {
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching owner bookings:',
        currentUser.user.email,
      );

      // Проверяем, что пользователь является владельцем
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Access denied. Only salon owners can access this endpoint.',
          HttpStatus.FORBIDDEN,
        );
      }

      const bookings = await this.bookingsService.getOwnerBookings(
        currentUser.user.id,
      );

      console.log('✅ Owner bookings fetched successfully:', bookings.length);
      return bookings;
    } catch (error) {
      console.error('❌ Fetch owner bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch owner bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id/cancel')
  async cancelBooking(
    @Param('id') bookingId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('🚫 Cancel booking request:', {
        bookingId,
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated for cancel:', currentUser.user.email);

      const result = await this.bookingsService.cancelBooking(
        bookingId,
        currentUser.user.id,
      );

      console.log('✅ Booking cancelled successfully:', bookingId);
      return {
        success: true,
        message: 'Booking canceled successfully',
      };
    } catch (error) {
      console.error('❌ Cancel booking failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to cancel booking',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async updateBooking(
    @Param('id') bookingId: string,
    @Body()
    data: {
      serviceId?: string;
      staffId?: string;
      time?: string;
      notes?: string;
    },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Update booking request:', {
        bookingId,
        data,
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for update booking:',
        currentUser.user.email,
      );

      // Проверяем, что пользователь является владельцем
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Access denied. Only salon owners can update bookings.',
          HttpStatus.FORBIDDEN,
        );
      }

      const updatedBooking = await this.bookingsService.updateBooking(
        bookingId,
        data,
        currentUser.user.id,
      );

      console.log('✅ Booking updated successfully:', bookingId);
      return {
        success: true,
        booking: updatedBooking,
      };
    } catch (error) {
      console.error('❌ Update booking failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update booking',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put('update-completed')
  async updateCompletedBookings(
    @Body() data: { bookingIds: string[] },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('✅ Update completed bookings request:', {
        bookingIds: data.bookingIds,
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for update completed:',
        currentUser.user.email,
      );

      // Проверяем, что пользователь является владельцем
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Access denied. Only salon owners can access this endpoint.',
          HttpStatus.FORBIDDEN,
        );
      }

      const result = await this.bookingsService.updateBookingsToCompleted(
        data.bookingIds,
        currentUser.user.id,
      );

      console.log(
        '✅ Bookings updated to completed successfully:',
        result.count,
      );
      return {
        success: true,
        message: `${result.count} bookings updated to completed`,
        updatedCount: result.count,
      };
    } catch (error) {
      console.error('❌ Update completed bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update completed bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
