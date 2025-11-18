import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackDto } from './dto/feedback.dto';
import { AuthService } from '../auth/auth.service';

@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        }));
        return new BadRequestException({
          message: 'Validation failed',
          errors: result,
        });
      },
    }),
  )
  async sendFeedback(
    @Body() feedbackDto: FeedbackDto,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      // Get current user for additional context (optional)
      if (authHeader) {
        try {
          const currentUser = await this.authService.getCurrentUser(authHeader);
          if (currentUser?.user) {
            feedbackDto.userId = currentUser.user.id;
            feedbackDto.userEmail = currentUser.user.email ?? undefined;
            feedbackDto.userName = currentUser.user.name ?? undefined;
          }
        } catch (error) {
          // If auth fails, continue without user info (optional)
          console.warn('Could not get user info for feedback:', error);
        }
      }

      return await this.feedbackService.sendFeedback(feedbackDto);
    } catch (error) {
      console.error('Feedback error:', error);
      throw new BadRequestException(
        error.message || 'Failed to send feedback. Please try again.',
      );
    }
  }
}
