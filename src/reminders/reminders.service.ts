import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

type BookingWithRelations = {
  id: string;
  dateTime: Date;
  status: string;
  reminderSent: boolean;
  User: {
    id: string;
    name: string | null;
    email: string;
  };
  Service: {
    id: string;
    name: string;
    duration: number;
    price: number;
  };
  Salon: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
  };
  Staff: {
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
      console.log('🔔 Starting booking reminders check (24 hours before)...');

      // Get current date and time in UTC
      const now = new Date();

      // Calculate 24 hours from now (in milliseconds)
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

      // Window for sending reminders: 24 hours ± 15 minutes
      // This ensures we don't miss reminders if cron runs slightly off schedule
      // With cron running every 15 minutes, this window is optimal
      const reminderWindowStart = new Date(
        now.getTime() + twentyFourHoursInMs - 15 * 60 * 1000,
      ); // 23.75 hours
      const reminderWindowEnd = new Date(
        now.getTime() + twentyFourHoursInMs + 15 * 60 * 1000,
      ); // 24.25 hours

      console.log(
        `Looking for bookings scheduled between ${reminderWindowStart.toISOString()} and ${reminderWindowEnd.toISOString()}`,
      );

      // Find CONFIRMED bookings that are scheduled in ~24 hours (within our window)
      const bookings: BookingWithRelations[] =
        await this.prisma.booking.findMany({
          where: {
            dateTime: {
              gte: reminderWindowStart,
              lte: reminderWindowEnd,
            },
            status: {
              in: ['CONFIRMED'],
            },
            reminderSent: false, // Only send reminders that haven't been sent yet
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            Service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
              },
            },
            Salon: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
              },
            },
            Staff: {
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
          // Format date and time for display - use UTC to avoid timezone conversion
          const bookingDate = new Date(booking.dateTime);
          const dateStr = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          });
          // Use UTC hours and minutes directly to avoid timezone conversion
          const hours = bookingDate.getUTCHours();
          const minutes = bookingDate.getUTCMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          const timeStr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

          // Prepare booking data for email
          const bookingData = {
            serviceName: booking.Service.name,
            date: dateStr,
            time: timeStr,
            duration: booking.Service.duration,
            price: booking.Service.price,
            salonName: booking.Salon.name,
            salonAddress: booking.Salon.address || undefined,
            salonPhone: booking.Salon.phone || undefined,
            staffName: booking.Staff?.name || undefined,
          };

          // Send reminder email
          await this.emailService.sendBookingReminder(
            booking.User.email,
            booking.User.name || 'Valued Customer',
            bookingData,
          );

          // Mark reminder as sent
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSent: true },
          });

          console.log(
            `✅ Reminder sent for booking ${booking.id} to ${booking.User.email}`,
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
      console.log('🔄 Starting auto-cancel for pending bookings...');

      // Get current date and time
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // Find pending bookings older than 3 hours
      const pendingBookings = await this.prisma.booking.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: threeHoursAgo,
          },
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Service: {
            select: {
              id: true,
              name: true,
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log(
        `📊 Found ${pendingBookings.length} pending bookings to cancel`,
      );

      let cancelledCount = 0;
      let errorCount = 0;

      // Cancel each pending booking
      for (const booking of pendingBookings) {
        try {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELED' },
          });

          console.log(
            `✅ Cancelled booking ${booking.id} (created at ${booking.createdAt.toISOString()})`,
          );
          cancelledCount++;
        } catch (error) {
          console.error(`❌ Error cancelling booking ${booking.id}:`, error);
          errorCount++;
        }
      }

      console.log(
        `🔄 Auto-cancel completed: ${cancelledCount} cancelled, ${errorCount} errors`,
      );

      return {
        total: pendingBookings.length,
        cancelled: cancelledCount,
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
      const result = await this.sendBookingReminders();
      return {
        success: true,
        message: 'Reminder system test completed',
        data: result,
      };
    } catch (error) {
      console.error('❌ Reminder system test failed:', error);
      return {
        success: false,
        message: 'Reminder system test failed',
        error: error.message,
      };
    }
  }
}
