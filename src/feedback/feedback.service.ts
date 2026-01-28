import { Injectable, Logger } from '@nestjs/common';
import { FeedbackDto } from './dto/feedback.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendFeedback(feedbackDto: FeedbackDto) {
    const { message, userId, userEmail, userName } = feedbackDto;

    try {
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // Get feedback email from environment or use default
      const feedbackEmail =
        process.env.FEEDBACK_EMAIL || 'hello@henzo.app';

      // Send email via EmailService
      await this.emailService.sendContactMessage({
        to: feedbackEmail,
        subject: `📝 New Feedback from ${userName || 'User'}`,
        template: 'feedback',
        context: {
          name: userName || 'Anonymous User',
          email: userEmail || 'No email provided',
          message: this.formatFeedbackMessage(
            message,
          ),
          timestamp,
        },
      });

      this.logger.log('Feedback sent via email successfully');

      return {
        success: true,
        message: 'Thank you for your feedback!',
      };
    } catch (error) {
      this.logger.error('Error sending feedback:', error);
      throw error;
    }
  }

  private formatFeedbackMessage(
    message: string,
  ): string {
    let formattedMessage = message;

    return formattedMessage;
  }
}
