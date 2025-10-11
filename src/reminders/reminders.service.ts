import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

type BookingWithRelations = {
  id: string;
  dateTime: Date;
  status: string;
  reminderSent: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  service: {
    id: string;
    name: string;
    duration: number;
    price: number;
  };
  salon: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
  };
  staff: {
    id: string;
    name: string;
  } | null;
};

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async sendBookingReminders() {
    try {
      console.log('🔔 Starting booking reminders check...');

      // Get current date and time
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      console.log(
        `📅 Looking for bookings between ${tomorrow.toISOString()} and ${tomorrowEnd.toISOString()}`,
      );

      // Find bookings that are scheduled for tomorrow
      const bookings: BookingWithRelations[] =
        await this.prisma.booking.findMany({
          where: {
            dateTime: {
              gte: tomorrow,
              lte: tomorrowEnd,
            },
            status: {
              in: ['CONFIRMED'],
            },
            reminderSent: false, // Only send reminders that haven't been sent yet
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
              },
            },
            salon: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
              },
            },
            staff: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      console.log(`📊 Found ${bookings.length} bookings to send reminders for`);

      let successCount = 0;
      let errorCount = 0;

      // Send reminders for each booking
      for (const booking of bookings) {
        try {
          // Format date and time for display
          const bookingDate = new Date(booking.dateTime);
          const dateStr = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const timeStr = bookingDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          // Prepare booking data for email
          const bookingData = {
            serviceName: booking.service.name,
            date: dateStr,
            time: timeStr,
            duration: booking.service.duration,
            price: booking.service.price,
            salonName: booking.salon.name,
            salonAddress: booking.salon.address || undefined,
            salonPhone: booking.salon.phone || undefined,
            staffName: booking.staff?.name || undefined,
          };

          // Send reminder email
          await this.emailService.sendBookingReminder(
            booking.user.email,
            booking.user.name || 'Valued Customer',
            bookingData,
          );

          // Mark reminder as sent
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSent: true },
          });

          console.log(
            `✅ Reminder sent for booking ${booking.id} to ${booking.user.email}`,
          );
          successCount++;
        } catch (error) {
          console.error(
            `❌ Error sending reminder for booking ${booking.id}:`,
            error,
          );
          errorCount++;
        }
      }

      console.log(
        `📧 Reminder process completed: ${successCount} sent, ${errorCount} errors`,
      );

      return {
        total: bookings.length,
        sent: successCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error('❌ Error in sendBookingReminders:', error);
      throw error;
    }
  }

  async cancelPendingBookingsAfter3Hours() {
    try {
      console.log('🔄 Starting auto-cancel check for pending bookings...');

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      console.log(
        `🕒 Looking for pending bookings created before ${threeHoursAgo.toISOString()}`,
      );

      // Find pending bookings older than 3 hours
      const pendingBookings: BookingWithRelations[] =
        await this.prisma.booking.findMany({
          where: {
            status: 'PENDING',
            createdAt: {
              lt: threeHoursAgo,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
              },
            },
            salon: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
              },
            },
            staff: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      console.log(
        `📊 Found ${pendingBookings.length} pending bookings to auto-cancel`,
      );

      let successCount = 0;
      let errorCount = 0;

      // Cancel each booking and notify client
      for (const booking of pendingBookings) {
        try {
          // Update booking status to CANCELED
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELED' },
          });

          // Format date and time for display
          const bookingDate = new Date(booking.dateTime);
          const dateStr = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const timeStr = bookingDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          // Send rejection email to client
          await this.emailService.sendBookingRejection(
            booking.user.email,
            booking.user.name || 'Valued Customer',
            {
              serviceName: booking.service.name,
              date: dateStr,
              time: timeStr,
              duration: booking.service.duration,
              price: booking.service.price,
              salonName: booking.salon.name,
              salonAddress: booking.salon.address || undefined,
              salonPhone: booking.salon.phone || undefined,
              staffName: booking.staff?.name || undefined,
              reason:
                'The salon did not respond within 3 hours. Please try booking again or contact the salon directly.',
            },
          );

          console.log(
            `✅ Auto-cancelled booking ${booking.id} and notified ${booking.user.email}`,
          );
          successCount++;
        } catch (error) {
          console.error(
            `❌ Error auto-cancelling booking ${booking.id}:`,
            error,
          );
          errorCount++;
        }
      }

      console.log(
        `🔄 Auto-cancel process completed: ${successCount} cancelled, ${errorCount} errors`,
      );

      return {
        total: pendingBookings.length,
        cancelled: successCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error('❌ Error in cancelPendingBookingsAfter3Hours:', error);
      throw error;
    }
  }

  async testReminderSystem() {
    try {
      console.log('🧪 Testing reminder system...');

      // Get a sample booking for testing
      const sampleBooking: BookingWithRelations | null =
        await this.prisma.booking.findFirst({
          where: {
            status: {
              in: ['CONFIRMED'],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
              },
            },
            salon: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
              },
            },
            staff: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      if (!sampleBooking) {
        console.log('⚠️ No bookings found for testing');
        return { success: false, message: 'No bookings found for testing' };
      }

      // Format date and time for display
      const bookingDate = new Date(sampleBooking.dateTime);
      const dateStr = bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = bookingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // Prepare booking data for email
      const bookingData = {
        serviceName: sampleBooking.service.name,
        date: dateStr,
        time: timeStr,
        duration: sampleBooking.service.duration,
        price: sampleBooking.service.price,
        salonName: sampleBooking.salon.name,
        salonAddress: sampleBooking.salon.address || undefined,
        salonPhone: sampleBooking.salon.phone || undefined,
        staffName: sampleBooking.staff?.name || undefined,
      };

      // Send test reminder email
      await this.emailService.sendBookingReminder(
        sampleBooking.user.email,
        sampleBooking.user.name || 'Test Customer',
        bookingData,
      );

      console.log('✅ Test reminder sent successfully');
      return { success: true, message: 'Test reminder sent successfully' };
    } catch (error) {
      console.error('❌ Error in testReminderSystem:', error);
      return { success: false, message: error.message };
    }
  }
}
