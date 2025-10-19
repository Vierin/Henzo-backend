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

      // Create booking with PENDING status
      const booking = await this.prisma.booking.create({
        data: {
          salonId: data.salonId,
          userId: userId,
          serviceId: data.serviceId,
          staffId: selectedStaffId,
          dateTime: new Date(data.time),
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
          dateTime: 'desc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
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
          dateTime: {
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
          dateTime: 'asc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
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
          dateTime: {
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
          dateTime: 'desc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
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
          dateTime: 'desc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      console.error('❌ Error fetching salon bookings:', error.message);
      throw error;
    }
  }

  async getOwnerBookings(ownerId: string) {
    try {
      console.log('📅 Fetching bookings for owner:', ownerId);

      // Сначала находим салоны, принадлежащие владельцу
      const ownerSalons = await this.prisma.salon.findMany({
        where: {
          ownerId: ownerId,
        },
        select: {
          id: true,
        },
      });

      if (ownerSalons.length === 0) {
        console.log('⚠️ No salons found for owner');
        return [];
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Получаем все бронирования для салонов владельца
      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: {
            in: salonIds,
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          dateTime: 'desc',
        },
      });

      // Update status to COMPLETED for past bookings
      const now = new Date();
      const updatedBookings: any[] = [];

      for (const booking of bookings) {
        if (
          (booking.status === 'CONFIRMED' || booking.status === 'PENDING') &&
          booking.dateTime < now
        ) {
          // Update booking status to COMPLETED
          const updatedBooking = await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'COMPLETED' as any },
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  duration: true,
                  price: true,
                },
              },
              staff: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              salon: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });
          updatedBookings.push(updatedBooking);
        } else {
          updatedBookings.push(booking);
        }
      }

      // Map dateTime to time for frontend compatibility
      return updatedBookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      console.error('❌ Error fetching owner bookings:', error.message);
      throw error;
    }
  }

  private async findAvailableStaff(
    salonId: string,
    bookingTime: Date,
    serviceDuration: number,
  ) {
    try {
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
        // Check if staff has any conflicting bookings (including pending ones)
        const conflictingBooking = await this.prisma.booking.findFirst({
          where: {
            staffId: staff.id,
            status: {
              in: ['PENDING', 'CONFIRMED'], // Consider both pending and confirmed bookings
            },
            OR: [
              // Booking starts during our booking time
              {
                dateTime: {
                  gte: bookingTime,
                  lt: bookingEndTime,
                },
              },
              // Booking ends during our booking time
              {
                dateTime: {
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
      // Format booking data for emails - parse UTC time without timezone conversion
      const dateTimeString =
        booking.dateTime?.toISOString?.() ||
        booking.dateTime?.toString() ||
        booking.dateTime;
      const { formattedDate, formattedTime } =
        this.formatBookingDateTime(dateTimeString);

      // For PENDING bookings, only send notification to salon with confirmation links
      if (booking.status === 'PENDING') {
        await this.emailService.sendSalonBookingRequest(
          booking.salon.email || booking.salon.owner?.email,
          booking.salon.name,
          {
            bookingId: booking.id,
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

        // Note: Client does NOT receive email at this stage to avoid spam.
        // They only get notified after salon confirms or rejects the booking.
      } else if (booking.status === 'CONFIRMED') {
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
          booking.salon.email || booking.salon.owner?.email,
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
      }
    } catch (error) {
      console.error('❌ Error sending booking notifications:', error);
      throw error;
    }
  }

  async cancelBooking(bookingId: string, userId: string) {
    try {
      // Check if booking exists
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
        },
        include: {
          salon: true,
          user: true,
        },
      });

      if (!booking) {
        console.log('❌ Booking not found:', bookingId);
        throw new Error('Booking not found');
      }

      // Check if user has permission to cancel (either the client or salon owner)
      const isClient = booking.userId === userId;
      const isOwner = booking.salon.ownerId === userId;

      console.log('🔐 Permission check:', { isClient, isOwner });

      if (!isClient && !isOwner) {
        console.log('❌ No permission to cancel booking');
        throw new Error('You do not have permission to cancel this booking');
      }

      // Check if booking can be canceled (not already canceled or past)
      if (booking.status === 'CANCELED') {
        throw new Error('Booking is already canceled');
      }

      if (booking.status === ('COMPLETED' as any)) {
        throw new Error('Cannot cancel a booking that has already completed');
      }

      // Check if booking time has passed
      const now = new Date();
      if (booking.dateTime < now) {
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

  async updateBooking(
    bookingId: string,
    data: {
      serviceId?: string;
      staffId?: string;
      time?: string;
      notes?: string;
      status?: string;
    },
    ownerId: string,
  ) {
    try {
      // First, verify that the booking belongs to one of the owner's salons
      const existingBooking = await this.prisma.booking.findFirst({
        where: { id: bookingId },
        include: {
          salon: true,
          service: true,
          staff: true,
        },
      });

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      if (existingBooking.salon.ownerId !== ownerId) {
        throw new Error(
          'Access denied. This booking does not belong to your salon.',
        );
      }

      // Prepare update data
      const updateData: any = {};

      if (data.serviceId) {
        // Validate that the service exists and belongs to the same salon
        const service = await this.prisma.service.findFirst({
          where: {
            id: data.serviceId,
            salonId: existingBooking.salonId,
          },
        });

        if (!service) {
          throw new Error('Service not found or does not belong to this salon');
        }

        updateData.service = { connect: { id: data.serviceId } };
      }

      if (data.staffId) {
        // Validate that the staff member exists and belongs to the same salon
        const staff = await this.prisma.staff.findFirst({
          where: {
            id: data.staffId,
            salonId: existingBooking.salonId,
          },
        });

        if (!staff) {
          throw new Error(
            'Staff member not found or does not belong to this salon',
          );
        }

        updateData.staff = { connect: { id: data.staffId } };
      }

      if (data.time) {
        updateData.dateTime = new Date(data.time);
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      if (data.status) {
        updateData.status = data.status;
      }

      // Track if status changed
      const statusChanged =
        data.status && data.status !== existingBooking.status;
      const oldStatus = existingBooking.status;

      // Update the booking
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Send email notification if status changed
      if (statusChanged && updatedBooking.user.email) {
        try {
          // Format date and time for email
          const bookingDate = new Date(updatedBooking.dateTime);
          const formattedDate = bookingDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
          const formattedTime = bookingDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          if (data.status === 'CONFIRMED') {
            // Send confirmation email to client
            await this.emailService.sendBookingConfirmation(
              updatedBooking.user.email,
              updatedBooking.user.name || 'Client',
              {
                serviceName: updatedBooking.service.name,
                date: formattedDate,
                time: formattedTime,
                duration: updatedBooking.service.duration,
                price: updatedBooking.service.price,
                salonName: updatedBooking.salon.name,
              },
            );
          } else if (data.status === 'CANCELED') {
            // Send rejection email to client
            await this.emailService.sendBookingRejection(
              updatedBooking.user.email,
              updatedBooking.user.name || 'Client',
              {
                serviceName: updatedBooking.service.name,
                date: formattedDate,
                time: formattedTime,
                duration: updatedBooking.service.duration,
                price: updatedBooking.service.price,
                salonName: updatedBooking.salon.name,
              },
            );
          }
        } catch (emailError) {
          console.error('❌ Error sending status change email:', emailError);
          // Don't fail the update if email fails
        }
      }

      return updatedBooking;
    } catch (error) {
      console.error('❌ Update booking error:', error);
      throw error;
    }
  }

  async updateBookingsToCompleted(bookingIds: string[], ownerId: string) {
    try {
      // Verify that all bookings belong to the owner's salons
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Update bookings to COMPLETED status
      const result = await this.prisma.booking.updateMany({
        where: {
          id: {
            in: bookingIds,
          },
          salonId: {
            in: salonIds,
          },
          status: {
            in: ['CONFIRMED', 'PENDING'], // Update confirmed or pending bookings
          },
        },
        data: {
          status: 'COMPLETED' as any,
        },
      });

      return { count: result.count };
    } catch (error) {
      console.error('❌ Update bookings to completed error:', error);
      throw error;
    }
  }

  async getBookingsByDateAndSalon(
    salonId: string,
    date: string,
    status: string = 'CONFIRMED',
  ) {
    try {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');

      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId,
          status: status as any,
          dateTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          service: {
            select: {
              duration: true,
            },
          },
        },
        orderBy: {
          dateTime: 'asc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      console.error('❌ Error fetching bookings by date and salon:', error);
      throw error;
    }
  }

  async confirmBooking(bookingId: string) {
    try {
      // Find booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'PENDING') {
        throw new Error('Only pending bookings can be confirmed');
      }

      // Update status to CONFIRMED
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      // Send confirmation email to client
      const dateTimeString = updatedBooking.dateTime.toISOString();
      const { formattedDate, formattedTime } =
        this.formatBookingDateTime(dateTimeString);

      await this.emailService.sendBookingConfirmation(
        updatedBooking.user.email,
        updatedBooking.user.name || 'Client',
        {
          serviceName: updatedBooking.service.name,
          date: formattedDate,
          time: formattedTime,
          duration: updatedBooking.service.duration,
          price: updatedBooking.service.price,
          salonName: updatedBooking.salon.name,
          salonAddress: updatedBooking.salon.address ?? undefined,
          salonPhone: updatedBooking.salon.phone ?? undefined,
          staffName: updatedBooking.staff?.name,
        },
      );

      return updatedBooking;
    } catch (error) {
      console.error('❌ Error confirming booking:', error);
      throw error;
    }
  }

  async rejectBooking(bookingId: string, reason?: string) {
    try {
      // Find booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'PENDING') {
        throw new Error('Only pending bookings can be rejected');
      }

      // Update status to CANCELED
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED' },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      // Send rejection email to client
      const dateTimeString = updatedBooking.dateTime.toISOString();
      const { formattedDate, formattedTime } =
        this.formatBookingDateTime(dateTimeString);

      await this.emailService.sendBookingRejection(
        updatedBooking.user.email,
        updatedBooking.user.name || 'Client',
        {
          serviceName: updatedBooking.service.name,
          date: formattedDate,
          time: formattedTime,
          duration: updatedBooking.service.duration,
          price: updatedBooking.service.price,
          salonName: updatedBooking.salon.name,
          salonAddress: updatedBooking.salon.address ?? undefined,
          salonPhone: updatedBooking.salon.phone ?? undefined,
          staffName: updatedBooking.staff?.name,
          reason,
        },
      );

      console.log('❌ Booking rejected successfully:', bookingId);
      return updatedBooking;
    } catch (error) {
      console.error('❌ Error rejecting booking:', error);
      throw error;
    }
  }

  /**
   * Format booking datetime without timezone conversion
   * This ensures that 11:00 UTC is displayed as 11:00 in emails
   */
  private formatBookingDateTime(dateTimeString: string) {
    try {
      // If it's a UTC string like "2024-01-15T11:00:00.000Z"
      if (dateTimeString.includes('Z')) {
        // Extract the date and time parts
        const [datePart, timePart] = dateTimeString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [time, ms] = timePart.split('.');
        const [hours, minutes, seconds] = time.split(':').map(Number);

        // Create a local date with the same time components (no timezone conversion)
        const localDate = new Date(
          year,
          month - 1,
          day,
          hours,
          minutes,
          seconds || 0,
          0,
        );

        const formattedDate = localDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const formattedTime = localDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        return { formattedDate, formattedTime };
      }

      // Fallback to regular parsing
      const bookingDate = new Date(dateTimeString);

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

      return { formattedDate, formattedTime };
    } catch (error) {
      console.error('❌ Error formatting booking datetime:', error);
      // Fallback to original string
      return {
        formattedDate: 'Invalid Date',
        formattedTime: 'Invalid Time',
      };
    }
  }
}
