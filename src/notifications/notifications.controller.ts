import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthService } from '../auth/auth.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  @Post('push-token')
  async savePushToken(
    @Body() data: { token: string; platform: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      await this.notificationsService.savePushToken(
        currentUser.user.id,
        data.token,
        data.platform,
      );

      return {
        success: true,
        message: 'Push token saved successfully',
      };
    } catch (error) {
      console.error('❌ Failed to save push token:', error);
      throw new HttpException(
        error.message || 'Failed to save push token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

