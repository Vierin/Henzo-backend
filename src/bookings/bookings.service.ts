import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createBooking(data: CreateBookingDto, userId: string) {
    try {
      console.log('📅 Creating booking:', { data, userId });

      // Validate that the service exists and belongs to the salon
      const service = await this.prisma.service.findFirst({
        where: {
          id: data.serviceId,
          salonId: data.salonId,
        },
      });

      if (!service) {
        throw new Error('Service not found or does not belong to this salon');
      }

      let selectedStaffId = data.staffId;

      // If no staff selected, find an available staff member
      if (!selectedStaffId) {
        selectedStaffId =
          (await this.findAvailableStaff(
            data.salonId,
            new Date(data.time),
            service.duration,
          )) || undefined;
      }

      // Create booking
      const booking = await this.prisma.booking.create({
        data: {
          salonId: data.salonId,
          userId: userId,
          serviceId: data.serviceId,
          staffId: selectedStaffId,
          time: new Date(data.time),
          status: 'PENDING',
          notes: data.notes,
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      console.log('✅ Booking created successfully:', booking.id);

      // Send email notifications
      try {
        await this.sendBookingNotifications(booking);
      } catch (emailError) {
        console.error('❌ Error sending email notifications:', emailError);
        // Don't fail the booking creation if email fails
      }

      return booking;
    } catch (error) {
      console.error('❌ Error creating booking:', error.message);
      throw error;
    }
  }

  async getUserBookings(userId: string) {
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      throw error;
    }
  }

  async getUpcomingBookings(userId: string) {
    try {
      const now = new Date();
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
          time: {
            gte: now,
          },
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
        orderBy: {
          time: 'asc',
        },
      });

      return bookings;
    } catch (error) {
      throw error;
    }
  }

  async getCompletedBookings(userId: string) {
    try {
      const now = new Date();
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
          time: {
            lt: now,
          },
          status: {
            in: ['CONFIRMED', 'CANCELED'],
          },
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      throw error;
    }
  }

  async getSalonBookings(salonId: string) {
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: salonId,
        },
        include: {
          service: true,
          staff: true,
          user: true,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      console.error('❌ Error fetching salon bookings:', error.message);
      throw error;
    }
  }

  private async findAvailableStaff(
    salonId: string,
    bookingTime: Date,
    serviceDuration: number,
  ) {
    try {
      console.log('🔍 Finding available staff for:', {
        salonId,
        bookingTime,
        serviceDuration,
      });

      // Calculate booking end time
      const bookingEndTime = new Date(
        bookingTime.getTime() + serviceDuration * 60000,
      );

      // Get all staff members for this salon
      const allStaff = await this.prisma.staff.findMany({
        where: {
          salonId: salonId,
        },
      });

      if (allStaff.length === 0) {
        console.log('⚠️ No staff members found for salon');
        return null;
      }

      // Check which staff members are available at this time
      const availableStaff: typeof allStaff = [];

      for (const staff of allStaff) {
        // Check if staff has any conflicting bookings
        const conflictingBooking = await this.prisma.booking.findFirst({
          where: {
            staffId: staff.id,
            status: {
              not: 'CANCELED',
            },
            OR: [
              // Booking starts during our booking time
              {
                time: {
                  gte: bookingTime,
                  lt: bookingEndTime,
                },
              },
              // Booking ends during our booking time
              {
                time: {
                  lte: bookingTime,
                  gte: new Date(bookingTime.getTime() - 60 * 60 * 1000), // Check 1 hour before
                },
              },
            ],
          },
        });

        if (!conflictingBooking) {
          availableStaff.push(staff);
        }
      }

      if (availableStaff.length === 0) {
        console.log('⚠️ No available staff found, using first staff member');
        return allStaff[0].id;
      }

      // Randomly select from available staff
      const randomIndex = Math.floor(Math.random() * availableStaff.length);
      const selectedStaff = availableStaff[randomIndex];

      console.log('✅ Selected available staff:', selectedStaff.name);
      return selectedStaff.id;
    } catch (error) {
      console.error('❌ Error finding available staff:', error.message);
      // Fallback to first staff member if error occurs
      const fallbackStaff = await this.prisma.staff.findFirst({
        where: { salonId },
      });
      return fallbackStaff?.id || null;
    }
  }

  private async sendBookingNotifications(booking: any) {
    try {
      console.log('📧 Sending booking notifications...');

      // Format booking data for emails
      const bookingDate = new Date(booking.time);
      const formattedDate = bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const formattedTime = bookingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Send confirmation to client
      await this.emailService.sendBookingConfirmation(
        booking.user.email,
        booking.user.name || 'Client',
        {
          serviceName: booking.service.name,
          date: formattedDate,
          time: formattedTime,
          duration: booking.service.duration,
          price: booking.service.price,
          salonName: booking.salon.name,
          salonAddress: booking.salon.address,
          salonPhone: booking.salon.phone,
          staffName: booking.staff?.name,
        },
      );

      // Send notification to salon
      await this.emailService.sendSalonNotification(
        booking.salon.email || booking.salon.owner.email,
        booking.salon.name,
        {
          serviceName: booking.service.name,
          date: formattedDate,
          time: formattedTime,
          duration: booking.service.duration,
          price: booking.service.price,
          clientName: booking.user.name || 'Client',
          clientEmail: booking.user.email,
          clientPhone: booking.user.phone,
          staffName: booking.staff?.name,
        },
      );

      console.log('✅ All booking notifications sent successfully');
    } catch (error) {
      console.error('❌ Error sending booking notifications:', error);
      throw error;
    }
  }

  async cancelBooking(bookingId: string, userId: string) {
    try {
      // Check if booking exists and belongs to user
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
          userId: userId,
        },
      });

      if (!booking) {
        throw new Error(
          'Booking not found or you do not have permission to cancel it',
        );
      }

      // Check if booking can be canceled (not already canceled or past)
      if (booking.status === 'CANCELED') {
        throw new Error('Booking is already canceled');
      }

      const now = new Date();
      if (booking.time < now) {
        throw new Error('Cannot cancel a booking that has already passed');
      }

      // Update booking status to CANCELED
      const updatedBooking = await this.prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          status: 'CANCELED',
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }
}
