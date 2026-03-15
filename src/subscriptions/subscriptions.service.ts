import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SUBSCRIPTION_PRICES } from './subscription-plans.constants';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async getCurrentSubscription(userId: string) {
    try {
      // Find user's salon
      const salon = await this.prisma.salon.findFirst({
        where: {
          ownerId: userId,
        },
        select: {
          id: true,
        },
      });

      if (!salon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      // Get subscription for this salon
      const subscription = await this.prisma.subscription.findUnique({
        where: {
          salonId: salon.id,
        },
      });

      if (!subscription) {
        // If no subscription exists, create TRIAL subscription with 3-month trial
        // This handles cases where salon was created before subscription system
        const now = new Date();
        const trialEndDate = new Date();
        trialEndDate.setMonth(now.getMonth() + 3); // 3 months trial
        const oneMonthFromTrialEnd = new Date(trialEndDate);
        oneMonthFromTrialEnd.setMonth(trialEndDate.getMonth() + 1);

        const newSubscription = await this.prisma.subscription.create({
          data: {
            salonId: salon.id,
            type: 'TRIAL',
            status: 'ACTIVE',
            startDate: now,
            endDate: oneMonthFromTrialEnd,
            nextPaymentDate: oneMonthFromTrialEnd,
            trialEndDate: trialEndDate,
            amount: 0.0, // Free during trial
            updatedAt: now,
          },
        });

        return newSubscription;
      }

      // Sync from Stripe if we have customer id but amount still 0 (e.g. webhook was missed)
      if (
        subscription.stripeCustomerId &&
        (subscription.amount == null || subscription.amount === 0)
      ) {
        try {
          const stripeSub =
            await this.stripeService.getActiveSubscriptionForCustomer(
              subscription.stripeCustomerId,
            );
          if (stripeSub) {
            const amount = stripeSub.interval === 'annual' ? 120 : 15;
            const endDate = new Date(stripeSub.currentPeriodEnd * 1000);
            await this.prisma.subscription.update({
              where: { salonId: salon.id },
              data: {
                type: 'STARTER',
                status: 'ACTIVE',
                endDate,
                nextPaymentDate: endDate,
                amount,
                updatedAt: new Date(),
              },
            });
            const updated = await this.prisma.subscription.findUnique({
              where: { salonId: salon.id },
            });
            if (updated) return this.attachStripeCancelStatus(updated);
          }
        } catch (e) {
          console.warn(
            'Stripe sync on getCurrentSubscription failed:',
            (e as Error)?.message,
          );
        }
      }

      return this.attachStripeCancelStatus(subscription);
    } catch (error) {
      console.error('❌ Error getting subscription:', error);
      throw error;
    }
  }

  private async attachStripeCancelStatus<
    T extends { stripeCustomerId?: string | null },
  >(
    subscription: T,
  ): Promise<T & { cancelAtPeriodEnd?: boolean; cancelAt?: string | null }> {
    const customerId = subscription.stripeCustomerId;
    if (!customerId) {
      return { ...subscription, cancelAtPeriodEnd: false, cancelAt: null };
    }
    try {
      const stripeSub =
        await this.stripeService.getActiveSubscription(customerId);
      if (!stripeSub) {
        return { ...subscription, cancelAtPeriodEnd: false, cancelAt: null };
      }
      return {
        ...subscription,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        cancelAt: stripeSub.cancel_at
          ? new Date(stripeSub.cancel_at * 1000).toISOString()
          : null,
      };
    } catch {
      return { ...subscription, cancelAtPeriodEnd: false, cancelAt: null };
    }
  }

  async cancelSubscription(
    userId: string,
  ): Promise<{ cancelledInStripe: boolean }> {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!salon) {
      throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
    }
    const subscription = await this.prisma.subscription.findUnique({
      where: { salonId: salon.id },
    });
    if (!subscription) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }

    let cancelledInStripe = false;

    if (subscription.stripeCustomerId) {
      try {
        const stripeSub = await this.stripeService.getActiveSubscription(
          subscription.stripeCustomerId,
        );
        if (stripeSub) {
          await this.stripeService.cancelSubscriptionAtPeriodEnd(stripeSub.id);
          cancelledInStripe = true;
          console.log(
            `✅ Stripe subscription ${stripeSub.id} set to cancel_at_period_end`,
          );
        } else {
          console.warn(
            '[Subscriptions] cancelSubscription: no active subscription in Stripe for customerId=',
            subscription.stripeCustomerId,
            '- marking cancelled in DB only.',
          );
        }
      } catch (e) {
        console.warn(
          '[Subscriptions] cancelSubscription: Stripe API error, marking cancelled in DB only.',
          (e as Error)?.message,
        );
      }
    }

    // Always mark in our DB: status CANCELLED, endDate = current endDate or nextPaymentDate
    const cancelDate =
      subscription.endDate ?? subscription.nextPaymentDate ?? new Date();
    await this.prisma.subscription.update({
      where: { salonId: salon.id },
      data: {
        status: 'CANCELLED',
        endDate: cancelDate,
        updatedAt: new Date(),
      },
    });

    return { cancelledInStripe };
  }

  async switchSubscription(userId: string, planType: 'STARTER') {
    try {
      // Find user's salon
      const salon = await this.prisma.salon.findFirst({
        where: {
          ownerId: userId,
        },
        select: {
          id: true,
        },
      });

      if (!salon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      // Get current subscription
      const currentSubscription = await this.prisma.subscription.findUnique({
        where: {
          salonId: salon.id,
        },
      });

      if (!currentSubscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      const now = new Date();
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(now.getMonth() + 1);

      // Update subscription
      const updatedSubscription = await this.prisma.subscription.update({
        where: {
          salonId: salon.id,
        },
        data: {
          type: planType,
          status: 'ACTIVE',
          startDate: now,
          endDate: oneMonthFromNow,
          nextPaymentDate: oneMonthFromNow,
          amount: SUBSCRIPTION_PRICES[planType],
          updatedAt: now,
        },
      });

      return updatedSubscription;
    } catch (error) {
      console.error('❌ Error switching subscription:', error);
      throw error;
    }
  }

  /**
   * Confirm checkout after redirect: fetch session from Stripe and activate subscription.
   * Used when webhook didn't run or didn't have metadata (e.g. local dev, webhook URL not reachable).
   */
  async confirmCheckoutSession(
    sessionId: string,
    userId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const session = await this.stripeService.retrieveCheckoutSession(sessionId);
    if (!session) {
      return { ok: false, error: 'Session not found' };
    }
    if (session.status !== 'complete') {
      return { ok: false, error: 'Session not complete' };
    }
    const metaUserId = session.metadata?.userId as string | undefined;
    if (metaUserId && metaUserId !== userId) {
      return { ok: false, error: 'Session does not belong to this user' };
    }
    const interval =
      (session.metadata?.interval as 'monthly' | 'annual') || null;
    if (!interval || !['monthly', 'annual'].includes(interval)) {
      return { ok: false, error: 'Missing or invalid interval in session' };
    }
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : ((session.customer as { id?: string } | null)?.id ??
          (await this.stripeService.getCustomerIdFromCheckoutSession(session)));
    try {
      await this.activateSubscriptionAfterStripePayment(
        metaUserId || userId,
        interval,
        stripeCustomerId,
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Activation failed' };
    }
  }

  /**
   * Called by Stripe webhook when checkout.session.completed — activate paid subscription.
   * If trial is still active (trialEndDate > now), paid period starts at trialEndDate, not at payment date.
   */
  async activateSubscriptionAfterStripePayment(
    userId: string,
    interval: 'monthly' | 'annual',
    stripeCustomerId: string | null = null,
  ) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!salon) {
      throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const current = await this.prisma.subscription.findUnique({
      where: { salonId: salon.id },
      select: { trialEndDate: true },
    });

    // Если триал ещё действует — платный период начинается с даты окончания триала
    const paidStart =
      current?.trialEndDate && new Date(current.trialEndDate) > now
        ? new Date(current.trialEndDate)
        : now;

    const endDate = new Date(paidStart);
    if (interval === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const amount = interval === 'annual' ? 120 : 15;

    await this.prisma.subscription.update({
      where: { salonId: salon.id },
      data: {
        type: 'STARTER',
        status: 'ACTIVE',
        startDate: paidStart,
        endDate,
        nextPaymentDate: endDate,
        ...(stripeCustomerId && { stripeCustomerId }),
        amount,
        updatedAt: now,
      },
    });
  }
}
