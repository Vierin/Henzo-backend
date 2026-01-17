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
          Booking: {
            select: {
              userId: true,
            },
            distinct: ['userId'],
          },
        },
      });

      const customersData = salonCustomers.map((salon) => ({
        salon: salon.name,
        totalCustomers: salon.Booking.length,
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
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          instagram: true,
          logo: true,
          photos: true,
          workingHours: true,
          reminderSettings: true,
          ownerId: true,
          createdAt: true,
          latitude: true,
          longitude: true,
          descriptionEn: true,
          descriptionVi: true,
          descriptionRu: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              Booking: true,
              Review: true,
              Staff: true,
              Service: true,
            },
          },
          Subscription: {
            select: {
              type: true,
              status: true,
              amount: true,
              startDate: true,
              endDate: true,
              nextPaymentDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Transform data to match frontend interface
      return salons.map((salon) => {
        // Ensure User data is available
        const userData = salon.User;
        
        return {
          id: salon.id,
          name: salon.name,
          description: salon.description || undefined,
          address: salon.address || undefined,
          phone: salon.phone || undefined,
          email: salon.email || undefined,
          website: salon.website || undefined,
          instagram: salon.instagram || undefined,
          logo: salon.logo || undefined,
          photos: Array.isArray(salon.photos) ? salon.photos : [],
          workingHours: salon.workingHours || undefined,
          createdAt: salon.createdAt instanceof Date 
            ? salon.createdAt.toISOString() 
            : salon.createdAt,
          owner: userData ? {
            id: userData.id,
            name: userData.name || undefined,
            email: userData.email,
          } : undefined,
          _count: {
            bookings: salon._count?.Booking || 0,
            reviews: salon._count?.Review || 0,
            staff: salon._count?.Staff || 0,
            services: salon._count?.Service || 0,
          },
          subscription: salon.Subscription ? {
            type: salon.Subscription.type,
            status: salon.Subscription.status,
            amount: salon.Subscription.amount,
            startDate: salon.Subscription.startDate instanceof Date 
              ? salon.Subscription.startDate.toISOString() 
              : salon.Subscription.startDate,
            endDate: salon.Subscription.endDate instanceof Date 
              ? salon.Subscription.endDate.toISOString() 
              : salon.Subscription.endDate || undefined,
            nextPaymentDate: salon.Subscription.nextPaymentDate instanceof Date 
              ? salon.Subscription.nextPaymentDate.toISOString() 
              : salon.Subscription.nextPaymentDate || undefined,
          } : undefined,
        };
      });
    } catch (error) {
      throw new Error(`Failed to get salons: ${error.message}`);
    }
  }

  async getAllBookings(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const page = params?.page || 1;
      const limit = Math.min(params?.limit || 20, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      // Status filter
      if (params?.status && params.status !== 'all') {
        where.status = params.status;
      }

      // Search filter (by salon name, user name, user email, service name)
      if (params?.search) {
        const searchTerm = params.search;
        where.OR = [
          { Salon: { name: { contains: searchTerm } } },
          { User: { name: { contains: searchTerm } } },
          { User: { email: { contains: searchTerm } } },
          { Service: { name: { contains: searchTerm } } },
        ];
      }

      // Build orderBy
      let orderBy: any = { createdAt: 'desc' }; // Default
      if (params?.sortBy) {
        switch (params.sortBy) {
          case 'date':
            orderBy = { dateTime: params.sortOrder || 'desc' };
            break;
          case 'salon':
            orderBy = { Salon: { name: params.sortOrder || 'asc' } };
            break;
          case 'client':
            orderBy = { User: { name: params.sortOrder || 'asc' } };
            break;
          case 'service':
            orderBy = { Service: { name: params.sortOrder || 'asc' } };
            break;
          default:
            orderBy = { createdAt: params.sortOrder || 'desc' };
        }
      }

      // Get total count for pagination
      const total = await this.prisma.booking.count({ where });

      // Get paginated bookings with optimized select
      const bookings = await this.prisma.booking.findMany({
        where,
        select: {
          id: true,
          dateTime: true,
          status: true,
          notes: true,
          createdAt: true,
          Salon: {
            select: {
              id: true,
              name: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Service: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      // Transform data to match frontend interface
      const transformedBookings = bookings.map((booking) => ({
        id: booking.id,
        time: booking.dateTime.toISOString(),
        status: booking.status,
        notes: booking.notes || undefined,
        createdAt: booking.createdAt.toISOString(),
        salon: booking.Salon ? {
          id: booking.Salon.id,
          name: booking.Salon.name,
        } : undefined,
        user: booking.User ? {
          id: booking.User.id,
          name: booking.User.name || undefined,
          email: booking.User.email,
        } : undefined,
        service: booking.Service ? {
          id: booking.Service.id,
          name: booking.Service.name,
          price: booking.Service.price,
        } : undefined,
        staff: booking.Staff ? {
          id: booking.Staff.id,
          name: booking.Staff.name,
        } : undefined,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        data: transformedBookings,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get bookings: ${error.message}`);
    }
  }

  async getSubscriptions() {
    try {
      const subscriptions = await this.prisma.subscription.findMany({
        include: {
          Salon: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return subscriptions.map((sub) => ({
        id: sub.id,
        salon: sub.Salon.name,
        subscriptionType: sub.type,
        status: sub.status,
        nextPaymentDate: sub.nextPaymentDate,
        amount: sub.amount,
        startDate: sub.startDate,
        endDate: sub.endDate,
      }));
    } catch (error) {
      throw new Error(`Failed to get subscriptions: ${error.message}`);
    }
  }

  async getMonthlyRevenue() {
    try {
      // Получаем все активные подписки
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          amount: true,
          startDate: true,
          endDate: true,
          nextPaymentDate: true,
        },
      });

      // Группируем по месяцам
      const monthlyRevenue: Record<string, number> = {};

      subscriptions.forEach((sub) => {
        if (!sub.amount || sub.amount === 0) return;

        // Рассчитываем все месяцы оплаты подписки
        const startDate = new Date(sub.startDate);
        const endDate = sub.endDate ? new Date(sub.endDate) : new Date();
        
        // Начинаем с даты начала подписки
        let paymentDate = new Date(startDate);
        
        // Генерируем все месяцы оплаты до конца подписки или текущей даты
        while (paymentDate <= endDate) {
          const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyRevenue[monthKey]) {
            monthlyRevenue[monthKey] = 0;
          }

          // Добавляем сумму подписки за этот месяц
          monthlyRevenue[monthKey] += sub.amount;

          // Переходим к следующему месяцу оплаты
          paymentDate = new Date(paymentDate);
          paymentDate.setMonth(paymentDate.getMonth() + 1);
        }
      });

      return monthlyRevenue;
    } catch (error) {
      throw new Error(`Failed to get monthly revenue: ${error.message}`);
    }
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
          Booking: {
            select: {
              userId: true,
            },
            distinct: ['userId'],
          },
        },
      });

      return salons.map((salon) => ({
        salon: salon.name,
        totalCustomers: salon.Booking.length,
      }));
    } catch (error) {
      throw new Error(`Failed to get customers: ${error.message}`);
    }
  }

  async getServiceCategoryDetails(serviceCategoryId: number) {
    try {
      const category = await this.prisma.service_categories.findUnique({
        where: { id: serviceCategoryId },
        select: {
          id: true,
          name_en: true,
          name_vn: true,
          name_ru: true,
          main_category_id: true,
        },
      });

      if (!category) {
        throw new Error('Service category not found');
      }

      // Get all services with this category, grouped by salon
      const services = await this.prisma.service.findMany({
        where: {
          serviceCategoryId: serviceCategoryId,
        },
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameVi: true,
          nameRu: true,
          price: true,
          duration: true,
          salonId: true,
          Salon: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          Salon: {
            name: 'asc',
          },
        },
      });

      // Group services by salon
      const servicesBySalon = services.reduce((acc, service) => {
        const salonId = service.salonId;
        const salonName = service.Salon?.name || 'Unknown Salon';

        if (!acc[salonId]) {
          acc[salonId] = {
            salonId,
            salonName,
            salonSlug: service.Salon?.slug || null,
            services: [],
          };
        }

        acc[salonId].services.push({
          id: service.id,
          name: service.name,
          nameEn: service.nameEn || service.name,
          nameVi: service.nameVi || service.name,
          nameRu: service.nameRu || service.name,
          price: service.price,
          duration: service.duration,
        });

        return acc;
      }, {} as Record<string, any>);

      const salons = Object.values(servicesBySalon).sort((a: any, b: any) =>
        a.salonName.localeCompare(b.salonName)
      );

      return {
        category,
        salons,
        totalServices: services.length,
        totalSalons: salons.length,
      };
    } catch (error) {
      throw new Error(`Failed to get service category details: ${error.message}`);
    }
  }

  async getStructure() {
    try {
      // Get all main categories (static from JSON - we'll use the same IDs)
      const mainCategories = [
        { id: 1, slug: 'hair-barber', name: 'Hair & Barber' },
        { id: 2, slug: 'tattoo-piercing', name: 'Tattoo & Piercing' },
        { id: 3, slug: 'massage-spa', name: 'Massage & Spa' },
        { id: 4, slug: 'manicure-pedicure', name: 'Manicure & Pedicure' },
        { id: 5, slug: 'brows-lashes', name: 'Brows & Lashes' },
        { id: 6, slug: 'other-services', name: 'Other Services' },
      ];

      // Get all service categories with their main_category_id and service counts
      const serviceCategories = await this.prisma.service_categories.findMany({
        select: {
          id: true,
          name_en: true,
          name_vn: true,
          name_ru: true,
          main_category_id: true,
          _count: {
            select: {
              Service: true,
            },
          },
        },
        orderBy: {
          name_en: 'asc',
        },
      });

      // Get all recommended services
      const recommendedServices = await this.prisma.recommendedService.findMany({
        select: {
          id: true,
          nameEn: true,
          nameVi: true,
          nameRu: true,
          categoryId: true,
          priority: true,
        },
        orderBy: [
          { priority: 'desc' },
          { nameEn: 'asc' },
        ],
      });

      // Group service categories by main_category_id
      const categoriesByMain = mainCategories.map((mainCat) => {
        const serviceCats = serviceCategories.filter(
          (sc) => sc.main_category_id === mainCat.id,
        );
        return {
          ...mainCat,
          serviceCategories: serviceCats.map((sc) => ({
            id: sc.id,
            nameEn: sc.name_en,
            nameVn: sc.name_vn,
            nameRu: sc.name_ru,
            serviceCount: sc._count.Service,
          })),
          totalServices: serviceCats.reduce(
            (sum, sc) => sum + sc._count.Service,
            0,
          ),
        };
      });

      // Also include service categories without main_category_id
      const unassignedCategories = serviceCategories
        .filter((sc) => !sc.main_category_id)
        .map((sc) => ({
          id: sc.id,
          nameEn: sc.name_en,
          nameVn: sc.name_vn,
          nameRu: sc.name_ru,
          serviceCount: sc._count.Service,
        }));

      return {
        mainCategories: categoriesByMain,
        unassignedCategories,
        recommendedServices: recommendedServices.map((rs) => ({
          id: rs.id,
          nameEn: rs.nameEn,
          nameVi: rs.nameVi,
          nameRu: rs.nameRu,
          categoryId: rs.categoryId,
          priority: rs.priority,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to get structure: ${error.message}`);
    }
  }
}
