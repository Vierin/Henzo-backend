import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_PRICES } from './subscription-plans.constants';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

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
        // If no subscription exists, create BASIC subscription with 3-month trial
        // This handles cases where salon was created before subscription system
        const now = new Date();
        const trialEndDate = new Date();
        trialEndDate.setMonth(now.getMonth() + 3); // 3 months trial
        const oneMonthFromTrialEnd = new Date(trialEndDate);
        oneMonthFromTrialEnd.setMonth(trialEndDate.getMonth() + 1);

        const newSubscription = await this.prisma.subscription.create({
          data: {
            salonId: salon.id,
            type: 'BASIC' as any,
            status: 'ACTIVE' as any,
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

      return subscription;
    } catch (error) {
      console.error('❌ Error getting subscription:', error);
      throw error;
    }
  }

  async switchSubscription(userId: string, planType: 'BASIC') {
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
          type: planType as any,
          status: 'ACTIVE' as any,
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
}
