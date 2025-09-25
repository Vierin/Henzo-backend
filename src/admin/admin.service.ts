import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    try {
      // Get total salons
      const totalSalons = await this.prisma.salon.count();

      // Get new salons (created in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newSalons = await this.prisma.salon.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      // Get total bookings in last 30 days
      const totalBookings = await this.prisma.booking.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      // Get bookings from 30 days before that for comparison
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const previousPeriodBookings = await this.prisma.booking.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      });

      // Calculate percentage change
      const bookingChange =
        previousPeriodBookings > 0
          ? Math.round(
              ((totalBookings - previousPeriodBookings) /
                previousPeriodBookings) *
                100,
            )
          : 0;

      // Get booking trends for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const bookingTrends = await this.prisma.booking.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: sixMonthsAgo,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Get SMS usage (mock data for now)
      const smsSent = 500;
      const smsBalance = 1000;

      // Get customer data per salon
      const salonCustomers = await this.prisma.salon.findMany({
        select: {
          id: true,
          name: true,
          bookings: {
            select: {
              userId: true,
            },
            distinct: ['userId'],
          },
        },
      });

      const customersData = salonCustomers.map((salon) => ({
        salon: salon.name,
        totalCustomers: salon.bookings.length,
      }));

      // Get subscription data (mock data for now)
      const subscriptions = [
        {
          salon: 'Salon A',
          subscriptionType: 'Premium',
          status: 'Active',
          nextPaymentDate: '2024-02-15',
        },
        {
          salon: 'Salon B',
          subscriptionType: 'Basic',
          status: 'Active',
          nextPaymentDate: '2024-03-01',
        },
        {
          salon: 'Salon C',
          subscriptionType: 'Premium',
          status: 'Inactive',
          nextPaymentDate: '2024-01-20',
        },
      ];

      return {
        overview: {
          newSalons,
          totalSalons,
        },
        bookingStats: {
          totalBookings,
          changePercent: bookingChange,
          trends: bookingTrends.map((trend) => ({
            date: trend.createdAt,
            count: trend._count.id,
          })),
        },
        subscriptions,
        smsUsage: {
          sent: smsSent,
          balance: smsBalance,
        },
        customers: customersData,
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error.message}`);
    }
  }

  async getAllSalons() {
    try {
      const salons = await this.prisma.salon.findMany({
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
              staff: true,
              services: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return salons;
    } catch (error) {
      throw new Error(`Failed to get salons: ${error.message}`);
    }
  }

  async getAllBookings() {
    try {
      const bookings = await this.prisma.booking.findMany({
        include: {
          salon: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      throw new Error(`Failed to get bookings: ${error.message}`);
    }
  }

  async getSubscriptions() {
    // Mock data for now since we don't have subscription table yet
    return [
      {
        id: '1',
        salon: 'Salon A',
        subscriptionType: 'Premium',
        status: 'Active',
        nextPaymentDate: '2024-02-15',
        amount: 99.99,
      },
      {
        id: '2',
        salon: 'Salon B',
        subscriptionType: 'Basic',
        status: 'Active',
        nextPaymentDate: '2024-03-01',
        amount: 49.99,
      },
      {
        id: '3',
        salon: 'Salon C',
        subscriptionType: 'Premium',
        status: 'Inactive',
        nextPaymentDate: '2024-01-20',
        amount: 99.99,
      },
    ];
  }

  async getSmsUsage() {
    // Mock data for now since we don't have SMS usage table yet
    return [
      {
        salon: 'Salon A',
        sent: 150,
        balance: 850,
      },
      {
        salon: 'Salon B',
        sent: 80,
        balance: 920,
      },
      {
        salon: 'Salon C',
        sent: 200,
        balance: 800,
      },
    ];
  }

  async getCustomers() {
    try {
      const salons = await this.prisma.salon.findMany({
        select: {
          id: true,
          name: true,
          bookings: {
            select: {
              userId: true,
            },
            distinct: ['userId'],
          },
        },
      });

      return salons.map((salon) => ({
        salon: salon.name,
        totalCustomers: salon.bookings.length,
      }));
    } catch (error) {
      throw new Error(`Failed to get customers: ${error.message}`);
    }
  }
}
