import { Controller, Post, Get } from '@nestjs/common';
import { RemindersService } from './reminders.service';

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
}
