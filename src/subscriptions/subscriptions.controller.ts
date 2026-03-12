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

  @Get('invoices')
  async getInvoices(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException('Only salon owners can access invoices', HttpStatus.FORBIDDEN);
      }
      const subscription = await this.subscriptionsService.getCurrentSubscription(currentUser.user.id);
      const customerId = (subscription as { stripeCustomerId?: string | null }).stripeCustomerId;
      if (!customerId) {
        return { invoices: [] };
      }
      const invoices = await this.stripeService.listInvoices(customerId);
      return { invoices };
    } catch (error: any) {
      console.error('❌ Get invoices failed:', error.message);
      throw new HttpException(
        error?.message ?? 'Failed to get invoices',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

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
    @Body('planType') planType: 'STARTER',
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Only salon owners can switch subscriptions',
          HttpStatus.FORBIDDEN,
        );
      }

      if (!planType || !['STARTER'].includes(planType)) {
        throw new HttpException(
          'Invalid plan type. Must be STARTER',
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
        successUrl: `${frontendUrl}/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
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

  @Post('cancel')
  async cancelSubscription(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException('Only salon owners can cancel subscription', HttpStatus.FORBIDDEN);
      }
      await this.subscriptionsService.cancelSubscription(currentUser.user.id);
      return { ok: true };
    } catch (error: any) {
      console.error('❌ Cancel subscription failed:', error?.message);
      throw new HttpException(
        error?.message ?? 'Failed to cancel subscription',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('confirm-checkout')
  async confirmCheckout(
    @Headers('authorization') authHeader: string,
    @Body('session_id') sessionId: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException('Only salon owners can confirm checkout', HttpStatus.FORBIDDEN);
      }
      if (!sessionId || typeof sessionId !== 'string') {
        throw new HttpException('session_id is required', HttpStatus.BAD_REQUEST);
      }
      const result = await this.subscriptionsService.confirmCheckoutSession(
        sessionId.trim(),
        currentUser.user.id,
      );
      if (!result.ok) {
        throw new HttpException(result.error ?? 'Confirm failed', HttpStatus.BAD_REQUEST);
      }
      return { ok: true };
    } catch (error: any) {
      console.error('❌ confirm-checkout failed:', error?.message);
      throw new HttpException(
        error?.message ?? 'Failed to confirm checkout',
        error?.status ?? HttpStatus.BAD_REQUEST,
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
    console.log(`[Stripe webhook] event.type=${event.type} id=${event.id}`);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionForLog = {
        id: session.id,
        customer: session.customer,
        subscription: session.subscription,
        metadata: session.metadata,
        mode: session.mode,
        status: session.status,
        payment_status: (session as { payment_status?: string }).payment_status,
      };
      console.log('[Stripe webhook] checkout.session.completed FULL SESSION:', JSON.stringify(sessionForLog, null, 2));
      const userId = session.metadata?.userId as string | undefined;
      const interval = session.metadata?.interval as 'monthly' | 'annual' | undefined;
      if (!userId || !interval || !['monthly', 'annual'].includes(interval)) {
        console.warn('[Stripe webhook] SKIP activation: missing metadata. userId=', userId, 'interval=', interval, 'metadata=', session.metadata);
      }
      let stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | null)?.id ?? null;
      if (!stripeCustomerId) {
        stripeCustomerId = await this.stripeService.getCustomerIdFromCheckoutSession(session);
        if (stripeCustomerId) console.log(`[Stripe webhook] customer resolved via subscription fallback: ${stripeCustomerId}`);
        else console.warn('[Stripe webhook] customer ID missing on session and could not resolve from subscription');
      }
      if (userId && interval && ['monthly', 'annual'].includes(interval)) {
        try {
          await this.subscriptionsService.activateSubscriptionAfterStripePayment(
            userId,
            interval,
            stripeCustomerId,
          );
          console.log(`✅ Subscription activated for user ${userId}, interval: ${interval}, stripeCustomerId=${stripeCustomerId ?? 'null'}`);
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

  @Post('create-portal-session')
  async createPortalSession(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'OWNER') {
        throw new HttpException(
          'Only salon owners can access billing portal',
          HttpStatus.FORBIDDEN,
        );
      }
      const subscription =
        await this.subscriptionsService.getCurrentSubscription(currentUser.user.id);
      const stripeCustomerId = (subscription as { stripeCustomerId?: string | null })?.stripeCustomerId;
      if (!stripeCustomerId) {
        throw new HttpException(
          'No billing account linked. Complete a payment first.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');
      const { url } = await this.stripeService.createBillingPortalSession({
        customerId: stripeCustomerId,
        returnUrl: `${frontendUrl}/subscription`,
      });
      return { url };
    } catch (error: any) {
      console.error('❌ Create portal session failed:', error?.message);
      throw new HttpException(
        error?.message || 'Failed to open billing portal',
        error?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}

