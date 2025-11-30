import { Controller, Post, Get } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('send')
  async sendReminders() {
    try {
      const result = await this.remindersService.sendBookingReminders();
      return {
        success: true,
        message: 'Reminders sent successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send reminders',
        error: error.message,
      };
    }
  }

  @Get('test')
  async testReminders() {
    try {
      const result = await this.remindersService.testReminderSystem();
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to test reminders',
        error: error.message,
      };
    }
  }

  @Post('auto-cancel')
  async autoCancelPendingBookings() {
    try {
      const result =
        await this.remindersService.cancelPendingBookingsAfter3Hours();
      return {
        success: true,
        message: 'Auto-cancel completed',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to auto-cancel bookings',
        error: error.message,
      };
    }
  }

  // Cron job: Run every 30 minutes to check for pending bookings older than 3 hours
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleAutoCancelCron() {
    console.log('🔄 Running auto-cancel cron job...');
    try {
      const result =
        await this.remindersService.cancelPendingBookingsAfter3Hours();
      console.log(
        `✅ Auto-cancel cron completed: ${result.cancelled} bookings cancelled`,
      );
    } catch (error) {
      console.error('❌ Auto-cancel cron failed:', error);
    }
  }

  // Cron job: Run every 30 minutes to check for bookings that need reminders
  // This ensures reminders are sent exactly 24 hours before each appointment
  @Cron('0,15,30,45 * * * *')
  async handleRemindersCron() {
    console.log('📧 Running reminders cron job (every 30 minutes)...');
    try {
      const result = await this.remindersService.sendBookingReminders();
      console.log(`✅ Reminders cron completed: ${result.sent} reminders sent`);
    } catch (error) {
      console.error('❌ Reminders cron failed:', error);
    }
  }
}
