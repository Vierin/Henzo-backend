import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export type CheckoutInterval = 'monthly' | 'annual';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private monthlyPriceId: string | null = null;
  private annualPriceId: string | null = null;
  private webhookSecret: string | null = null;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
      this.monthlyPriceId = this.configService.get<string>('STRIPE_MONTHLY_PRICE_ID') ?? null;
      this.annualPriceId =
        this.configService.get<string>('STRIPE_ANNUAL_PRICE_ID') ??
        this.configService.get<string>('STRIPE_YEARLY_PRICE_ID') ??
        null;
      this.webhookSecret =
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
    }
  }

  /**
   * Verify webhook signature and return the event. Throws if invalid or secret not set.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.stripe || !this.webhookSecret) {
      throw new HttpException(
        'Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  isConfigured(): boolean {
    return !!(
      this.stripe &&
      this.monthlyPriceId &&
      this.annualPriceId
    );
  }

  async createCheckoutSession(params: {
    customerEmail: string;
    interval: CheckoutInterval;
    successUrl: string;
    cancelUrl: string;
    metadata?: { salonId?: string; userId?: string };
  }): Promise<{ url: string }> {
    if (!this.stripe || !this.monthlyPriceId || !this.annualPriceId) {
      throw new HttpException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_MONTHLY_PRICE_ID, STRIPE_ANNUAL_PRICE_ID.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const priceId = params.interval === 'annual' ? this.annualPriceId : this.monthlyPriceId;
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [
        {
          price: priceId!,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        interval: params.interval,
        ...(params.metadata?.salonId && { salonId: params.metadata.salonId }),
        ...(params.metadata?.userId && { userId: params.metadata.userId }),
      },
    });

    if (!session.url) {
      throw new HttpException(
        'Stripe did not return a checkout URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { url: session.url };
  }
}
