import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

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
    timezone?: string; // IANA timezone identifier (e.g., "Asia/Ho_Chi_Minh")
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
      console.log(`⏰ Current time (UTC): ${now.toISOString()}`);
      console.log(`⏰ Current time (local): ${now.toString()}`);

      // Define all possible reminder intervals in hours
      const possibleIntervals = [3, 24]; // 3 hours, 1 day
      const windowMinutes = 15; // ±15 minutes window

      let totalSent = 0;
      let totalErrors = 0;

      // Process each interval
      for (const intervalHours of possibleIntervals) {
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const windowMs = windowMinutes * 60 * 1000;
        
        // Calculate a wider window to account for timezone differences
        // We'll filter more precisely later for each booking's timezone
        // Use a wider window: ±2 hours to account for timezone offsets (max ±12 hours)
        const wideWindowMs = 2 * 60 * 60 * 1000; // ±2 hours
        const reminderWindowStart = new Date(
          now.getTime() + intervalMs - wideWindowMs,
        );
        const reminderWindowEnd = new Date(
          now.getTime() + intervalMs + wideWindowMs,
        );

        console.log(
          `Checking ${intervalHours}h interval: bookings between ${reminderWindowStart.toISOString()} and ${reminderWindowEnd.toISOString()}`,
        );

        // Find CONFIRMED bookings that might be scheduled at this interval
        // We use a wider window and filter precisely later
        let bookings: BookingWithRelations[];
        try {
          bookings = (await this.prisma.booking.findMany({
            where: {
              dateTime: {
                gte: reminderWindowStart,
                lte: reminderWindowEnd,
              },
              status: {
                in: ['CONFIRMED'], // Only send reminders for confirmed bookings
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
                  timezone: true,
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
          `📊 Found ${bookings.length} bookings for ${intervalHours}h interval (window: ${reminderWindowStart.toISOString()} - ${reminderWindowEnd.toISOString()})`,
        );

        // Process each booking
        for (const booking of bookings) {
          try {
            // Calculate time until booking in UTC (dateTime is stored in UTC)
            const timeUntilBooking = booking.dateTime.getTime() - now.getTime();
            const hoursUntilBooking = timeUntilBooking / (1000 * 60 * 60);
            
            // Get salon timezone
            const salonTimezone = booking.Salon?.timezone || 'Asia/Ho_Chi_Minh';
            
            // IMPORTANT: dateTime is stored in UTC but represents the appointment time in salon's timezone
            // We need to check if the time difference matches the reminder interval
            // The interval should be calculated from the current time to the booking time
            const targetIntervalMs = intervalMs;
            const minIntervalMs = targetIntervalMs - windowMs;
            const maxIntervalMs = targetIntervalMs + windowMs;
            
            // Check if the time until booking is within the reminder window
            const isWithinWindow = 
              timeUntilBooking >= minIntervalMs && 
              timeUntilBooking <= maxIntervalMs;
            
            console.log(
              `🔍 Processing booking ${booking.id}: dateTime=${booking.dateTime.toISOString()}, hoursUntil=${hoursUntilBooking.toFixed(2)}, interval=${intervalHours}h, timezone=${salonTimezone}, withinWindow=${isWithinWindow}, targetInterval=${(targetIntervalMs / (1000 * 60 * 60)).toFixed(2)}h, window=[${(minIntervalMs / (1000 * 60 * 60)).toFixed(2)}h, ${(maxIntervalMs / (1000 * 60 * 60)).toFixed(2)}h]`,
            );

            // Skip if not within the precise reminder window
            if (!isWithinWindow) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: not within ${intervalHours}h reminder window (${hoursUntilBooking.toFixed(2)}h until booking)`,
              );
              continue;
            }

            // Get salon reminder settings
            const reminderSettings = (booking.Salon.reminderSettings as any) || {
              intervals: [24],
            };
            const salonIntervals = reminderSettings.intervals || [24];

            // Check if this interval is enabled for this salon
            if (!salonIntervals.includes(intervalHours)) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: ${intervalHours}h interval not enabled for salon (enabled: ${salonIntervals.join(', ')})`,
              );
              continue;
            }

            // Check if reminder for this interval was already sent (normalize to numbers: JSON may return strings)
            const rawSent = booking.remindersSentIntervals;
            const sentIntervals = Array.isArray(rawSent)
              ? rawSent.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
              : [];
            if (sentIntervals.includes(intervalHours)) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: ${intervalHours}h reminder already sent (sent: ${sentIntervals.join(', ')})`,
              );
              continue;
            }

            // Re-fetch to avoid duplicate send when cron runs overlap or multiple workers
            const fresh = await this.prisma.booking.findUnique({
              where: { id: booking.id },
              select: { remindersSentIntervals: true },
            });
            const freshSent = fresh?.remindersSentIntervals;
            const freshIntervals = Array.isArray(freshSent)
              ? freshSent.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
              : [];
            if (freshIntervals.includes(intervalHours)) {
              console.log(
                `⏭️ Skipping booking ${booking.id}: ${intervalHours}h reminder already sent (re-check, sent: ${freshIntervals.join(', ')})`,
              );
              continue;
            }

            // Format date and time for display - convert from UTC to salon's timezone
            // Use date-fns-tz for proper timezone conversion
            // salonTimezone already defined above
            
            const bookingDate = new Date(booking.dateTime);
            const zonedDate = toZonedTime(bookingDate, salonTimezone);
            
            const dateStr = formatInTimeZone(bookingDate, salonTimezone, 'EEEE, MMMM d, yyyy');
            
            // Format time in salon's timezone
            const timeStr = formatInTimeZone(bookingDate, salonTimezone, 'hh:mm a');

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

            // Mark this interval as sent (use freshIntervals so we don't overwrite intervals added by another worker)
            const updatedSentIntervals = [...freshIntervals, intervalHours];
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
