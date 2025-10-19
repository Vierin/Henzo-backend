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
