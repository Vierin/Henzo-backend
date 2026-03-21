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
  Header,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SendMagicLinkDto } from './dto/send-magic-link.dto';
import { AuthService } from '../auth/auth.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly authService: AuthService,
  ) {}

  /** Parse Accept-Language header to email locale: en, ru, vi */
  private parseEmailLocale(acceptLanguage?: string): 'en' | 'ru' | 'vi' {
    if (!acceptLanguage) return 'en';
    const lower = acceptLanguage.toLowerCase();
    if (lower.includes('ru')) return 'ru';
    if (lower.includes('vi')) return 'vi';
    return 'en';
  }

  @Post()
  async createBooking(
    @Body() data: CreateBookingDto,
    @Headers('authorization') authHeader: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    try {
      console.log('📅 Received booking request:', {
        hasAuthHeader: !!authHeader,
        serviceId: data.serviceId,
        salonId: data.salonId,
        hasClientEmail: !!data.clientEmail,
      });

      // getCurrentUser автоматически создаст пользователя в БД, если его нет
      let currentUser;
      try {
        currentUser = await this.authService.getCurrentUser(authHeader);
        console.log(
          '✅ User authenticated for booking:',
          currentUser.user.email,
        );
      } catch (error) {
        console.error('❌ Failed to get/create user:', error.message);
        // Если не удалось получить/создать пользователя, пробуем еще раз
        // (может быть race condition при создании)
        await new Promise((resolve) => setTimeout(resolve, 500));
        currentUser = await this.authService.getCurrentUser(authHeader);
        console.log(
          '✅ User authenticated for booking (retry):',
          currentUser.user.email,
        );
      }

      // If owner is creating booking for a client, use client's user ID
      let bookingUserId = currentUser.user.id;
      const isOwnerCreated = currentUser.user.role === 'OWNER';

      console.log('📋 Booking creation request:', {
        isOwnerCreated,
        hasClientEmail: !!data.clientEmail,
        clientEmail: data.clientEmail,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        salonId: data.salonId,
        ownerId: currentUser.user.id,
      });

      // Check if owner is creating booking in their own salon
      const isOwnerOfSalon = isOwnerCreated
        ? await this.bookingsService.verifySalonOwnership(
            data.salonId,
            currentUser.user.id,
          )
        : false;

      console.log('🔍 Salon ownership check:', {
        isOwnerCreated,
        isOwnerOfSalon,
        salonId: data.salonId,
        ownerId: currentUser.user.id,
      });

      // CRITICAL: If owner is creating booking, we MUST NOT use owner's user ID
      // Always create/find a client user instead
      if (isOwnerCreated && isOwnerOfSalon) {
        // Owner is creating booking in their own salon
        const hasClientEmail = data.clientEmail && data.clientEmail.trim();
        
        if (hasClientEmail) {
          // Owner is creating booking on behalf of a client with email
          const clientEmail = data.clientEmail!.trim(); // Safe because hasClientEmail is true
          console.log('📧 Owner creating booking for client with email:', {
            clientEmail: clientEmail,
            clientName: data.clientName,
            clientPhone: data.clientPhone,
          });
          bookingUserId = await this.bookingsService.findOrCreateClientUser(
            clientEmail,
            data.clientName,
            data.clientPhone,
          );
          console.log('✅ Using client user ID for booking:', bookingUserId);
        } else {
          // Owner creating booking without client email - MUST create anonymous client user
          // This ensures owner's data is NEVER used for the booking
          console.log('📧 Owner creating booking for anonymous client (no email provided):', {
            clientName: data.clientName || 'Anonymous Client',
            clientPhone: data.clientPhone,
            hasClientEmail: false,
            willCreateAnonymousUser: true,
          });
          bookingUserId = await this.bookingsService.createAnonymousClientUser(
            data.salonId,
            data.clientName || 'Anonymous Client',
            data.clientPhone,
          );
          console.log('✅ Created anonymous client user ID for booking:', bookingUserId);
          console.log('⚠️ Owner ID was:', currentUser.user.id, '- NOT using it for booking');
        }
      } else if (isOwnerCreated && !isOwnerOfSalon) {
        // Owner trying to book in another salon - this should be blocked on frontend
        // But if it happens, we should still not use owner's ID
        console.warn('⚠️ Owner trying to book in salon they do not own:', {
          ownerId: currentUser.user.id,
          salonId: data.salonId,
        });
        // Even in this case, if no client email provided, create anonymous client
        // This prevents owner's data from being used incorrectly
        if (!data.clientEmail || !data.clientEmail.trim()) {
          console.log('📧 Creating anonymous client even for wrong salon to prevent owner data usage');
          bookingUserId = await this.bookingsService.createAnonymousClientUser(
            data.salonId,
            data.clientName || 'Anonymous Client',
            data.clientPhone,
          );
        }
      }

      const emailLocale = this.parseEmailLocale(acceptLanguage);
      const booking = await this.bookingsService.createBooking(
        data,
        bookingUserId,
        isOwnerCreated,
        emailLocale,
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
  @Header('Cache-Control', 'public, max-age=300') // P3: Кэш на 5 минут
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
  @Header('Cache-Control', 'public, max-age=300') // P3: Кэш на 5 минут
  async getUpcomingBookings(
    @Headers('authorization') authHeader: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const bookings = await this.bookingsService.getUpcomingBookings(
        currentUser.user.id,
        {
          limit: limit ? parseInt(limit, 10) : undefined,
        },
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
  @Header('Cache-Control', 'public, max-age=600') // P3: Кэш на 10 минут (данные меняются редко)
  async getCompletedBookings(
    @Headers('authorization') authHeader: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const bookings = await this.bookingsService.getCompletedBookings(
        currentUser.user.id,
        {
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        },
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

      // Авторизация опциональна для получения bookings (публичный доступ)
      if (authHeader) {
        try {
          const currentUser = await this.authService.getCurrentUser(authHeader);
          console.log(
            '✅ User authenticated for fetching bookings:',
            currentUser.user.email,
          );
        } catch (error) {
          console.log(
            '⚠️ Auth failed, continuing without authentication:',
            error.message,
          );
          // Продолжаем без авторизации
        }
      } else {
        console.log('ℹ️ No auth header, fetching bookings as public');
      }

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
  async getOwnerBookings(
    @Headers('authorization') authHeader: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    try {
      console.log('📅 Fetching owner bookings:', {
        hasAuthHeader: !!authHeader,
        page,
        limit,
        status,
        date,
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

      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 500; // Dashboard needs a wide window

      const bookings = await this.bookingsService.getOwnerBookings(
        currentUser.user.id,
        {
          page: pageNum,
          limit: limitNum,
          status,
          date,
        },
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

  @Get('salon/:salonId/pending')
  async getPendingBookings(
    @Param('salonId') salonId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📅 Fetching pending bookings for salon:', {
        salonId,
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching pending bookings:',
        currentUser.user.email,
      );

      // Проверяем, что пользователь является владельцем
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Access denied. Only salon owners can access this endpoint.',
          HttpStatus.FORBIDDEN,
        );
      }

      // Проверяем владение салоном через метод сервиса
      const hasAccess = await this.bookingsService.verifySalonOwnership(
        salonId,
        currentUser.user.id,
      );

      if (!hasAccess) {
        throw new HttpException(
          'Salon not found or access denied',
          HttpStatus.FORBIDDEN,
        );
      }

      const bookings =
        await this.bookingsService.getPendingBookingsForSalon(salonId);

      console.log('✅ Pending bookings fetched successfully:', bookings.length);
      return {
        success: true,
        bookings,
      };
    } catch (error) {
      console.error('❌ Fetch pending bookings failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch pending bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('salon/:salonId/pending/count')
  async getPendingBookingsCount(
    @Param('salonId') salonId: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      // Проверяем, что пользователь является владельцем
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Access denied. Only salon owners can access this endpoint.',
          HttpStatus.FORBIDDEN,
        );
      }

      // Проверяем владение салоном через метод сервиса
      const hasAccess = await this.bookingsService.verifySalonOwnership(
        salonId,
        currentUser.user.id,
      );

      if (!hasAccess) {
        throw new HttpException(
          'Salon not found or access denied',
          HttpStatus.FORBIDDEN,
        );
      }

      const count =
        await this.bookingsService.getPendingBookingsCountForSalon(salonId);

      return {
        success: true,
        count,
      };
    } catch (error) {
      console.error('❌ Fetch pending bookings count failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch pending bookings count',
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
      status?: string;
      locale?: string;
    },
    @Headers('authorization') authHeader: string,
    @Headers('accept-language') acceptLanguage?: string,
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

      const locale = data.locale || this.parseEmailLocale(acceptLanguage);
      const updatedBooking = await this.bookingsService.updateBooking(
        bookingId,
        { ...data, locale },
        currentUser.user.id,
      );

      console.log('✅ Booking updated successfully:', bookingId);

      // Map dateTime to time for frontend compatibility
      const bookingResponse = {
        ...updatedBooking,
        time: updatedBooking.dateTime,
      };

      return {
        success: true,
        booking: bookingResponse,
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

  @Put(':id/confirm')
  async confirmBooking(
    @Param('id') bookingId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    try {
      console.log('✅ Confirm booking request:', bookingId);
      const locale = this.parseEmailLocale(acceptLanguage);
      const result = await this.bookingsService.confirmBooking(
        bookingId,
        locale,
      );

      console.log('✅ Booking confirmed successfully:', bookingId);
      return {
        success: true,
        message: 'Booking confirmed successfully',
        booking: result,
      };
    } catch (error) {
      console.error('❌ Confirm booking failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to confirm booking',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id/reject')
  async rejectBooking(
    @Param('id') bookingId: string,
    @Body() data?: { reason?: string },
  ) {
    try {
      console.log('❌ Reject booking request:', bookingId);

      const result = await this.bookingsService.rejectBooking(
        bookingId,
        data?.reason,
      );

      console.log('❌ Booking rejected successfully:', bookingId);
      return {
        success: true,
        message: 'Booking rejected successfully',
        booking: result,
      };
    } catch (error) {
      console.error('❌ Reject booking failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to reject booking',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('send-magic-link')
  async sendMagicLink(@Body() data: SendMagicLinkDto) {
    try {
      console.log('🔗 Send magic link request:', {
        email: data.email,
        hasBookingData: !!data.bookingData,
      });

      const result = await this.bookingsService.sendMagicLink(
        data.email,
        data.bookingData,
      );

      console.log('✅ Magic link sent successfully');
      return {
        success: true,
        message: 'Confirmation email sent successfully',
      };
    } catch (error) {
      console.error('❌ Send magic link failed:', error.message);
      
      // If user already exists, return specific error code
      if (error.message === 'USER_EXISTS') {
        throw new HttpException(
          {
            code: 'USER_EXISTS',
            message: 'An account with this email already exists. Please login with your password.',
          },
          HttpStatus.CONFLICT, // 409 Conflict
        );
      }
      
      throw new HttpException(
        error.message || 'Failed to send magic link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('confirm-magic-link')
  async confirmMagicLink(@Query('token') token: string) {
    try {
      console.log('🔗 Confirm magic link request:', {
        hasToken: !!token,
      });

      if (!token) {
        throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.bookingsService.confirmMagicLink(token);

      console.log(
        '✅ Magic link confirmed, booking created:',
        result.bookingId,
      );
      return {
        success: true,
        bookingId: result.bookingId,
        email: result.email,
        message: 'Booking confirmed successfully',
      };
    } catch (error) {
      console.error('❌ Confirm magic link failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to confirm magic link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
