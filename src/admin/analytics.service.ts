import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics(period: '7d' | '30d' | '90d' = '30d') {
    const now = new Date();
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - periodDays);

    // Get salon stats
    const totalSalons = await this.prisma.salon.count();
    const newSalons = await this.prisma.salon.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Count active salons (with at least 1 booking)
    const salonsWithBookings = await this.prisma.booking.groupBy({
      by: ['salonId'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });
    const activeSalons = salonsWithBookings.length;

    // Get booking stats
    const totalBookings = await this.prisma.booking.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    const pendingBookings = await this.prisma.booking.count({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: startDate,
        },
      },
    });

    const confirmedBookings = await this.prisma.booking.count({
      where: {
        status: 'CONFIRMED',
        createdAt: {
          gte: startDate,
        },
      },
    });

    const completedBookings = await this.prisma.booking.count({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
        },
      },
    });

    const canceledBookings = await this.prisma.booking.count({
      where: {
        status: 'CANCELED',
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Get bookings by day
    const bookingsByDay = await this.getBookingsByDay(startDate, now);

    // Get top services
    const topServices = await this.getTopServices(startDate);

    // Get top salons
    const topSalons = await this.getTopSalons(startDate);

    return {
      salons: {
        total: totalSalons,
        new: newSalons,
        active: activeSalons,
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        canceled: canceledBookings,
        byDay: bookingsByDay,
      },
      topServices,
      topSalons,
    };
  }

  private async getBookingsByDay(startDate: Date, endDate: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by day
    const byDay = new Map<string, number>();
    bookings.forEach((booking) => {
      const date = booking.createdAt.toISOString().split('T')[0];
      byDay.set(date, (byDay.get(date) || 0) + 1);
    });

    // Fill missing days with 0
    const result: { date: string; count: number }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: byDay.get(dateStr) || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  private async getTopServices(startDate: Date) {
    const services = await this.prisma.booking.groupBy({
      by: ['serviceId'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        serviceId: true,
      },
      orderBy: {
        _count: {
          serviceId: 'desc',
        },
      },
      take: 5,
    });

    // Get service details
    const topServices = await Promise.all(
      services.map(async (item) => {
        const service = await this.prisma.service.findUnique({
          where: { id: item.serviceId },
          include: {
            service_categories: true,
          },
        });

        return {
          name: service?.name || 'Unknown',
          count: item._count.serviceId,
          categoryName: service?.service_categories?.name_en,
        };
      }),
    );

    return topServices;
  }

  private async getTopSalons(startDate: Date) {
    const salons = await this.prisma.booking.groupBy({
      by: ['salonId'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        salonId: true,
      },
      orderBy: {
        _count: {
          salonId: 'desc',
        },
      },
      take: 5,
    });

    // Get salon details
    const topSalons = await Promise.all(
      salons.map(async (item) => {
        const salon = await this.prisma.salon.findUnique({
          where: { id: item.salonId },
        });

        return {
          name: salon?.name || 'Unknown',
          bookingsCount: item._count.salonId,
        };
      }),
    );

    return topSalons;
  }
}
