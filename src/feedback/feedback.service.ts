import { Injectable, Logger } from '@nestjs/common';
import { FeedbackDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  async sendFeedback(feedbackDto: FeedbackDto) {
    const { message, userId, userEmail, userName } = feedbackDto;

    try {
      // Get Telegram bot token and chat ID from environment
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_FEEDBACK_CHAT_ID;

      if (!botToken || !chatId) {
        this.logger.warn(
          'Telegram bot token or chat ID not configured. Feedback not sent.',
        );
        // Still return success to not break user experience
        return {
          success: true,
          message: 'Feedback received. Thank you!',
        };
      }

      // Format message for Telegram
      const telegramMessage = this.formatTelegramMessage(
        message,
        userId,
        userEmail,
        userName,
      );

      // Send to Telegram
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('Failed to send feedback to Telegram:', errorData);
        throw new Error('Failed to send feedback to Telegram');
      }

      this.logger.log('Feedback sent to Telegram successfully');

      return {
        success: true,
        message: 'Thank you for your feedback!',
      };
    } catch (error) {
      this.logger.error('Error sending feedback:', error);
      throw error;
    }
  }

  private formatTelegramMessage(
    message: string,
    userId?: string,
    userEmail?: string,
    userName?: string,
  ): string {
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    let formattedMessage = `<b>📝 New Feedback</b>\n\n`;
    formattedMessage += `<b>Message:</b>\n${message}\n\n`;

    if (userName) {
      formattedMessage += `<b>User:</b> ${userName}\n`;
    }
    if (userEmail) {
      formattedMessage += `<b>Email:</b> ${userEmail}\n`;
    }
    if (userId) {
      formattedMessage += `<b>User ID:</b> ${userId}\n`;
    }

    formattedMessage += `\n<b>Time:</b> ${timestamp}`;

    return formattedMessage;
  }
}
