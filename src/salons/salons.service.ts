import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private prisma: PrismaService) {}

  async findSalonsWithServices() {
    return this.prisma.salon.findMany({
      include: {
        services: {
          include: {
            serviceCategory: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // New optimized search method with pagination and filters
  async searchSalons(params: {
    page?: number;
    limit?: number;
    search?: string;
    location?: string;
    category?: string;
    sortBy?: string;
    minRating?: number;
    isOpenNow?: boolean;
  }) {
    const {
      page = 1,
      limit = 20,
      search = '',
      location = '',
      category = '',
      sortBy = 'name',
      minRating = 0,
      isOpenNow = false,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Text search (full-text search would be better, but this is a start)
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
        {
          services: {
            some: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Location filter
    if (location.trim()) {
      where.address = { contains: location, mode: 'insensitive' };
    }

    // Category filter
    if (category && category !== 'all') {
      where.services = {
        some: {
          serviceCategory: {
            nameEn: { equals: category, mode: 'insensitive' },
          },
        },
      };
    }

    // Rating filter
    if (minRating > 0) {
      where.reviews = {
        some: {
          rating: { gte: minRating },
        },
      };
    }

    // Build orderBy clause
    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'name-desc':
        orderBy = { name: 'desc' };
        break;
      case 'rating':
        orderBy = { reviews: { _count: 'desc' } };
        break;
      case 'services':
        orderBy = { services: { _count: 'desc' } };
        break;
      case 'created':
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get total count for pagination
    const total = await this.prisma.salon.count({ where });

    // Get paginated results
    const salons = await this.prisma.salon.findMany({
      where,
      include: {
        services: {
          include: {
            serviceCategory: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: salons,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  // Static categories - no need for database query
  getSalonCategories() {
    return [
      { id: '1', name: 'Hair & Barber' },
      { id: '2', name: 'Tattoo & Piercing' },
      { id: '3', name: 'Massage & Spa' },
      { id: '4', name: 'Manicure & Pedicure' },
      { id: '5', name: 'Cosmetic Medicine' },
      { id: '6', name: 'Other Services' },
    ];
  }

  async getCurrentUserSalon(userId: string) {
    console.log('🔍 Looking for salon for user:', userId);
    const salon = await this.prisma.salon.findFirst({
      where: {
        ownerId: userId,
      },
      include: {
        services: true,
        staff: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log('🔍 Salon found:', salon ? `ID: ${salon.id}` : 'None');
    if (salon) {
      // Get static categories based on categoryIds
      const staticCategories = this.getSalonCategories();
      const salonCategories = staticCategories.filter((cat) =>
        (salon as any).categoryIds.includes(cat.id),
      );

      // Add categories to salon object
      (salon as any).categories = salonCategories;
    }
    return salon;
  }

  async createCurrentUserSalon(createSalonDto: CreateSalonDto, userId: string) {
    try {
      const { categoryIds, ...salonData } = createSalonDto;

      // Create salon and subscription in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the salon
        const salon = await prisma.salon.create({
          data: {
            ...salonData,
            ownerId: userId,
            categoryIds: categoryIds || [],
          } as any,
          include: {
            services: true,
            staff: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Create freemium subscription for the new salon
        const now = new Date();
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(now.getFullYear() + 1);

        await prisma.subscription.create({
          data: {
            salonId: salon.id,
            type: 'FREEMIUM' as any,
            status: 'ACTIVE' as any,
            startDate: now,
            endDate: oneYearFromNow,
            nextPaymentDate: oneYearFromNow, // No payment needed for freemium
            amount: 0.0, // Free subscription
          },
        });

        return salon;
      });

      // Add categories to salon object
      const staticCategories = this.getSalonCategories();
      const salonCategories = staticCategories.filter((cat) =>
        (result as any).categoryIds.includes(cat.id),
      );
      (result as any).categories = salonCategories;

      console.log(
        `✅ Created salon "${result.name}" with freemium subscription`,
      );
      return result;
    } catch (error) {
      console.error('❌ Database error creating salon:', error.message);
      throw error;
    }
  }

  async updateCurrentUserSalon(updateSalonDto: UpdateSalonDto, userId: string) {
    const existingSalon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
    });

    if (!existingSalon) {
      throw new Error('Salon not found');
    }

    const { categoryIds, ...salonData } = updateSalonDto;

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: {
        ...salonData,
        categoryIds: categoryIds || (existingSalon as any).categoryIds,
      } as any,
      include: {
        services: true,
        staff: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Add categories to salon object
    const staticCategories = this.getSalonCategories();
    const salonCategories = staticCategories.filter((cat) =>
      (updatedSalon as any).categoryIds.includes(cat.id),
    );
    (updatedSalon as any).categories = salonCategories;

    return updatedSalon; // Возвращаем салон напрямую
  }

  async findById(id: string) {
    console.log('SalonsService.findById called with id:', id);

    // First, let's check if salon exists at all
    const salonExists = await this.prisma.salon.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    console.log('Salon exists check:', salonExists);

    // Check reviews separately
    const reviewsCheck = await this.prisma.review.findMany({
      where: { salonId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    console.log('Reviews check for salon:', {
      salonId: id,
      reviewsCount: reviewsCheck.length,
      reviews: reviewsCheck.slice(0, 2),
    });

    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            serviceCategory: true,
          },
        },
        staff: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log('SalonsService.findById result:', {
      salonId: salon?.id,
      salonName: salon?.name,
      reviewsCount: salon?.reviews?.length || 0,
      reviews:
        salon?.reviews?.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          userId: r.userId,
          user: r.user,
        })) || [],
      fullSalonKeys: salon ? Object.keys(salon) : [],
    });

    if (salon) {
      // Add categories to salon object
      const staticCategories = this.getSalonCategories();
      const salonCategories = staticCategories.filter((cat) =>
        (salon as any).categoryIds.includes(cat.id),
      );
      (salon as any).categories = salonCategories;

      // If reviews are missing from the main query, add them manually
      if (!salon.reviews || salon.reviews.length === 0) {
        console.log('Reviews missing from main query, adding manually...');
        salon.reviews = reviewsCheck;
      }
    }

    return salon;
  }

  // New optimized methods for better performance

  async findSalonsPreview(params: {
    limit: number;
    page: number;
    location?: string;
    featured?: boolean;
  }) {
    const { limit, page, location, featured } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (location) {
      where.address = { contains: location, mode: 'insensitive' };
    }

    if (featured) {
      // Featured salons could be determined by rating, review count, etc.
      where.reviews = {
        some: {
          rating: { gte: 4.0 },
        },
      };
    }

    const [salons, total] = await Promise.all([
      this.prisma.salon.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          logo: true,
          photos: true, // Get all photos, but we'll only use the first one
          _count: {
            select: {
              reviews: true,
              services: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.salon.count({ where }),
    ]);

    return {
      data: salons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findFeaturedSalons(limit: number) {
    return this.prisma.salon.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        logo: true,
        photos: true,
        _count: {
          select: {
            reviews: true,
            services: true,
          },
        },
      },
      where: {
        reviews: {
          some: {
            rating: { gte: 4.5 },
          },
        },
      },
      orderBy: {
        reviews: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  async findNearbySalons(params: {
    lat?: number;
    lng?: number;
    radius: number;
    limit: number;
  }) {
    const { lat, lng, radius, limit } = params;

    // For now, return featured salons since we don't have geocoding
    // In production, you'd implement proper geospatial queries
    if (!lat || !lng) {
      return this.findFeaturedSalons(limit);
    }

    // TODO: Implement proper geospatial search with coordinates
    // For MVP, return salons with good ratings
    return this.prisma.salon.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        logo: true,
        photos: true,
        _count: {
          select: {
            reviews: true,
            services: true,
          },
        },
      },
      where: {
        reviews: {
          some: {
            rating: { gte: 4.0 },
          },
        },
      },
      orderBy: {
        reviews: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  async getSalonStats(salonId: string) {
    const [salon, reviews, services] = await Promise.all([
      this.prisma.salon.findUnique({
        where: { id: salonId },
        select: { id: true, name: true },
      }),
      this.prisma.review.findMany({
        where: { salonId },
        select: { rating: true },
      }),
      this.prisma.service.findMany({
        where: { salonId },
        select: { id: true },
      }),
    ]);

    if (!salon) {
      throw new Error('Salon not found');
    }

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0;

    return {
      salonId: salon.id,
      salonName: salon.name,
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviewCount: reviews.length,
      serviceCount: services.length,
    };
  }

  async getSalonAvailability(
    salonId: string,
    date?: string,
    serviceId?: string,
  ) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { workingHours: true },
    });

    if (!salon) {
      throw new Error('Salon not found');
    }

    // For MVP, return basic availability
    // In production, you'd check actual bookings and staff schedules
    const workingHours = salon.workingHours;

    return {
      salonId,
      date: date || new Date().toISOString().split('T')[0],
      isOpen: true, // Simplified for MVP
      workingHours,
      availableSlots: [
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
      ],
      message: 'Basic availability - full implementation coming soon',
    };
  }
}
