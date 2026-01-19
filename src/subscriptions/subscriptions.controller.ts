import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthService } from '../auth/auth.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly authService: AuthService,
  ) {}

  @Get('current')
  async getCurrentSubscription(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Only salon owners can access subscriptions',
          HttpStatus.FORBIDDEN,
        );
      }

      const subscription =
        await this.subscriptionsService.getCurrentSubscription(
          currentUser.user.id,
        );

      return subscription;
    } catch (error) {
      console.error('❌ Get current subscription failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to get subscription',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('switch')
  async switchSubscription(
    @Headers('authorization') authHeader: string,
    @Body('planType') planType: 'BASIC',
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Only salon owners can switch subscriptions',
          HttpStatus.FORBIDDEN,
        );
      }

      if (!planType || !['BASIC'].includes(planType)) {
        throw new HttpException(
          'Invalid plan type. Must be BASIC',
          HttpStatus.BAD_REQUEST,
        );
      }

      const subscription = await this.subscriptionsService.switchSubscription(
        currentUser.user.id,
        planType,
      );

      return subscription;
    } catch (error) {
      console.error('❌ Switch subscription failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to switch subscription',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}

