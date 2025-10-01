import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersScheduler {
  constructor(private readonly remindersService: RemindersService) {}

  // Run every day at 9:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyReminders() {
    console.log('🕘 Running daily booking reminders check...');

    try {
      const result = await this.remindersService.sendBookingReminders();
      console.log('✅ Daily reminders completed:', result);
    } catch (error) {
      console.error('❌ Error in daily reminders:', error);
    }
  }

  // Run every 6 hours for more frequent checks
  @Cron('0 */6 * * *')
  async handleFrequentReminders() {
    console.log('🕐 Running frequent booking reminders check...');

    try {
      const result = await this.remindersService.sendBookingReminders();
      console.log('✅ Frequent reminders completed:', result);
    } catch (error) {
      console.error('❌ Error in frequent reminders:', error);
    }
  }
}
