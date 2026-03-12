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

  /**
   * Retrieve a checkout session by ID (for confirm-checkout after redirect when webhook missed).
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    if (!this.stripe) return null;
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Resolve Stripe customer ID from a checkout session (for webhook).
   * session.customer can be missing in payload; fallback: fetch subscription and use subscription.customer.
   */
  async getCustomerIdFromCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
    const direct = typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | null)?.id ?? null;
    if (direct) return direct;
    const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as { id?: string } | null)?.id ?? null;
    if (!this.stripe || !subId) return null;
    try {
      const sub = await this.stripe.subscriptions.retrieve(subId, { expand: [] });
      const cust = (sub as { customer?: string }).customer;
      return typeof cust === 'string' ? cust : null;
    } catch {
      return null;
    }
  }

  /**
   * List active subscriptions for a Stripe customer. Returns the first active subscription if any.
   * Used to sync DB when webhook was missed (e.g. amount still 0 but customer has paid).
   */
  async getActiveSubscriptionForCustomer(customerId: string): Promise<{
    interval: 'monthly' | 'annual';
    currentPeriodEnd: number;
  } | null> {
    if (!this.stripe) return null;
    const subs = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'],
    });
    const sub = subs.data[0] as Stripe.Subscription | undefined;
    if (!sub?.items?.data[0]?.price?.id) return null;
    const priceId = sub.items.data[0].price.id;
    const isAnnual = priceId === this.annualPriceId;
    const periodEnd = (sub as { current_period_end?: number }).current_period_end;
    if (periodEnd == null) return null;
    return {
      interval: isAnnual ? 'annual' : 'monthly',
      currentPeriodEnd: periodEnd,
    };
  }

  /**
   * List invoices for a Stripe customer (for billing history table).
   */
  async listInvoices(customerId: string, limit = 12): Promise<Array<{
    id: string;
    number: string | null;
    date: string;
    amount: number;
    currency: string;
    status: string;
    pdfUrl: string | null;
  }>> {
    if (!this.stripe) return [];
    try {
      const res = await this.stripe.invoices.list({
        customer: customerId,
        limit,
        status: 'paid',
      });
      return res.data.map((inv) => {
        const currency = (inv.currency ?? 'vnd').toLowerCase();
        const isZeroDecimal = ['jpy', 'krw', 'vnd'].includes(currency);
        const amount = inv.amount_paid ?? 0;
        return {
          id: inv.id,
          number: inv.number ?? null,
          date: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString().slice(0, 10),
          amount: isZeroDecimal ? amount : amount / 100,
          currency: currency.toUpperCase(),
          status: inv.status ?? 'paid',
          pdfUrl: inv.invoice_pdf ?? null,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Create Stripe Customer Portal session for managing payment methods and billing.
   */
  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new HttpException(
        'Stripe is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    if (!session.url) {
      throw new HttpException(
        'Stripe did not return a portal URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { url: session.url };
  }
}
