import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { AuthService } from '../auth/auth.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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

  @Post('create-checkout-session')
  async createCheckoutSession(
    @Headers('authorization') authHeader: string,
    @Body('interval') interval: 'monthly' | 'annual',
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Only salon owners can create checkout sessions',
          HttpStatus.FORBIDDEN,
        );
      }

      if (!interval || !['monthly', 'annual'].includes(interval)) {
        throw new HttpException(
          'Invalid interval. Must be "monthly" or "annual"',
          HttpStatus.BAD_REQUEST,
        );
      }

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');

      const { url } = await this.stripeService.createCheckoutSession({
        customerEmail: currentUser.user.email,
        interval,
        successUrl: `${frontendUrl}/subscription?success=1`,
        cancelUrl: `${frontendUrl}/subscription?canceled=1`,
        metadata: {
          userId: currentUser.user.id,
        },
      });

      return { url };
    } catch (error: any) {
      console.error('❌ Create checkout session failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to create checkout session',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('stripe-webhook')
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing body or stripe-signature');
    }
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      console.error('❌ Stripe webhook signature verification failed:', err.message);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId as string | undefined;
      const interval = session.metadata?.interval as 'monthly' | 'annual' | undefined;
      if (userId && interval && ['monthly', 'annual'].includes(interval)) {
        try {
          await this.subscriptionsService.activateSubscriptionAfterStripePayment(
            userId,
            interval,
          );
          console.log(`✅ Subscription activated for user ${userId}, interval: ${interval}`);
        } catch (e: any) {
          console.error('❌ activateSubscriptionAfterStripePayment failed:', e?.message);
          throw new HttpException(
            e?.message || 'Failed to activate subscription',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }
    return { received: true };
  }
}

