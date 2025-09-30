import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(period: string = '30d') {
    try {
      // Calculate date range based on period
      const getDateRange = (period: string) => {
        const now = new Date();
        const startDate = new Date();

        switch (period) {
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
          case '3m':
            startDate.setMonth(now.getMonth() - 3);
            break;
          case '1y':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          default:
            startDate.setDate(now.getDate() - 30);
        }

        return { startDate, endDate: now };
      };

      const { startDate, endDate } = getDateRange(period);

      // Get total salons
      const totalSalons = await this.prisma.salon.count();

      // Get new salons (created in selected period)
      const newSalons = await this.prisma.salon.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get total bookings in selected period
      const totalBookings = await this.prisma.booking.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get bookings from previous period for comparison
      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);

      switch (period) {
        case '7d':
          previousPeriodStart.setDate(startDate.getDate() - 7);
          previousPeriodEnd.setDate(startDate.getDate() - 1);
          break;
        case '30d':
          previousPeriodStart.setDate(startDate.getDate() - 30);
          previousPeriodEnd.setDate(startDate.getDate() - 1);
          break;
        case '3m':
          previousPeriodStart.setMonth(startDate.getMonth() - 3);
          previousPeriodEnd.setMonth(startDate.getMonth() - 1);
          break;
        case '1y':
          previousPeriodStart.setFullYear(startDate.getFullYear() - 1);
          previousPeriodEnd.setMonth(startDate.getMonth() - 1);
          break;
      }

      const previousPeriodBookings = await this.prisma.booking.count({
        where: {
          createdAt: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd,
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

      // Get booking trends for the selected period
      const allBookings = await this.prisma.booking.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group bookings based on period
      let groupedData = new Map();

      if (period === '7d') {
        // Group by day
        allBookings.forEach((booking) => {
          const dayKey = booking.createdAt.toISOString().substring(0, 10); // YYYY-MM-DD format
          groupedData.set(dayKey, (groupedData.get(dayKey) || 0) + 1);
        });
      } else if (period === '30d') {
        // Group by week
        allBookings.forEach((booking) => {
          const date = new Date(booking.createdAt);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toISOString().substring(0, 10);
          groupedData.set(weekKey, (groupedData.get(weekKey) || 0) + 1);
        });
      } else {
        // Group by month for 3m and 1y
        allBookings.forEach((booking) => {
          const monthKey = booking.createdAt.toISOString().substring(0, 7); // YYYY-MM format
          groupedData.set(monthKey, (groupedData.get(monthKey) || 0) + 1);
        });
      }

      // Convert to array format expected by frontend
      const bookingTrends = Array.from(groupedData.entries()).map(
        ([key, count]) => ({
          date: period === '7d' || period === '30d' ? key : `${key}-01`,
          count,
        }),
      );

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

      // Get deleted salons (assuming we track deletion with a deletedAt field)
      // For now, we'll use mock data since we don't have deletion tracking
      const deletedSalons = Math.floor(newSalons * 0.1); // Mock: ~10% of new salons delete their accounts

      return {
        overview: {
          newSalons,
          totalSalons,
          deletedSalons,
        },
        bookingStats: {
          totalBookings,
          changePercent: bookingChange,
          trends: bookingTrends,
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
