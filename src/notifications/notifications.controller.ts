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
    @Body() data: { token: string; platform: string; language?: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const userId = currentUser.user.id;
      console.log('[Push] POST push-token:', {
        userId,
        platform: data.platform,
        language: data.language || 'en',
        tokenPrefix: data.token?.substring(0, 30) + '...',
      });

      await this.notificationsService.savePushToken(
        userId,
        data.token,
        data.platform,
        data.language || 'en',
      );

      console.log('[Push] Token saved for user', userId);
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

  /** Send a test push to the current user's device(s). Use for debugging. */
  @Post('test-push')
  async sendTestPush(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      await this.notificationsService.sendTestPush(currentUser.user.id);
      return { success: true, message: 'Test push sent' };
    } catch (error) {
      console.error('❌ Test push failed:', error);
      throw new HttpException(
        error.message || 'Test push failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
