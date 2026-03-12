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
      if (subscription.stripeCustomerId && (subscription.amount == null || subscription.amount === 0)) {
        try {
          const stripeSub = await this.stripeService.getActiveSubscriptionForCustomer(subscription.stripeCustomerId);
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
            if (updated) return updated;
          }
        } catch (e) {
          console.warn('Stripe sync on getCurrentSubscription failed:', (e as Error)?.message);
        }
      }

      return subscription;
    } catch (error) {
      console.error('❌ Error getting subscription:', error);
      throw error;
    }
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
   * Called by Stripe webhook when checkout.session.completed — activate paid subscription.
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
    const endDate = new Date(now);
    if (interval === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const amount = interval === 'annual' ? 120 : 15;

    // Keep trialEndDate so we can show "trial was until X, paid until Y"
    await this.prisma.subscription.update({
      where: { salonId: salon.id },
      data: {
        type: 'STARTER',
        status: 'ACTIVE',
        startDate: now, // start of paid period
        endDate,
        nextPaymentDate: endDate,
        ...(stripeCustomerId && { stripeCustomerId }),
        amount,
        updatedAt: now,
      },
    });
  }
}
