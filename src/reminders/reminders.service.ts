import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InputJsonValue } from '@prisma/client/runtime/library';

type BookingWithRelations = {
  id: string;
  dateTime: Date;
  status: string;
  reminderSent: boolean;
  remindersSentIntervals?: number[] | null;
  salonId: string;
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
    reminderSettings?: any;
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
      console.log('🔔 Starting booking reminders check for all intervals...');

      // Get current date and time in UTC
      const now = new Date();

      // Define all possible reminder intervals in hours
      const possibleIntervals = [3, 24, 168]; // 3 hours, 1 day, 1 week
      const windowMinutes = 15; // ±15 minutes window

      let totalSent = 0;
      let totalErrors = 0;

      // Process each interval
      for (const intervalHours of possibleIntervals) {
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const reminderWindowStart = new Date(
          now.getTime() + intervalMs - windowMinutes * 60 * 1000,
        );
        const reminderWindowEnd = new Date(
          now.getTime() + intervalMs + windowMinutes * 60 * 1000,
        );

        console.log(
          `Checking ${intervalHours}h interval: bookings between ${reminderWindowStart.toISOString()} and ${reminderWindowEnd.toISOString()}`,
        );

        // Find CONFIRMED bookings that are scheduled at this interval
        let bookings: BookingWithRelations[];
        try {
          bookings = (await this.prisma.booking.findMany({
            where: {
              dateTime: {
                gte: reminderWindowStart,
                lte: reminderWindowEnd,
              },
              status: {
                in: ['CONFIRMED'],
              },
            },
            select: {
              id: true,
              dateTime: true,
              status: true,
              reminderSent: true,
              remindersSentIntervals: true,
              salonId: true,
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
                  reminderSettings: true,
                },
              },
              Staff: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })) as BookingWithRelations[];
        } catch (error: any) {
          // Обработка ошибок пула соединений
          if (error.code === 'P2024') {
            console.error(
              '❌ Connection pool timeout. Retrying in 5 seconds...',
            );
            throw new Error(
              'Connection pool exhausted. Please try again later.',
            );
          }
          throw error;
        }

        console.log(
          `📊 Found ${bookings.length} bookings for ${intervalHours}h interval`,
        );

        // Process each booking
        for (const booking of bookings) {
          try {
            // Get salon reminder settings
            const reminderSettings = (booking.Salon.reminderSettings as any) || {
              intervals: [24],
            };
            const salonIntervals = reminderSettings.intervals || [24];

            // Check if this interval is enabled for this salon
            if (!salonIntervals.includes(intervalHours)) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: ${intervalHours}h interval not enabled for salon`,
              );
              continue;
            }

            // Check if reminder for this interval was already sent
            const sentIntervals =
              (booking.remindersSentIntervals as number[]) || [];
            if (sentIntervals.includes(intervalHours)) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: ${intervalHours}h reminder already sent`,
              );
              continue;
            }

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

            // Mark this interval as sent
            const updatedSentIntervals = [...sentIntervals, intervalHours];
            await this.prisma.booking.update({
              where: { id: booking.id },
              data: {
                reminderSent: true, // Keep for backward compatibility
                remindersSentIntervals: updatedSentIntervals as InputJsonValue,
              },
            });

            console.log(
              `✅ ${intervalHours}h reminder sent for booking ${booking.id} to ${booking.User.email}`,
            );
            totalSent++;
          } catch (error) {
            console.error(
              `❌ Error sending ${intervalHours}h reminder for booking ${booking.id}:`,
              error,
            );
            totalErrors++;
          }
        }
      }

      console.log(
        `📧 Reminder process completed: ${totalSent} sent, ${totalErrors} errors`,
      );

      return {
        total: totalSent + totalErrors,
        sent: totalSent,
        errors: totalErrors,
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
