import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';
import { GeocodingCacheService } from '../services/geocoding-cache.service';

@Injectable()
export class SalonsService {
  constructor(
    private prisma: PrismaService,
    private geocodingCache: GeocodingCacheService,
  ) {}

  async suggestSalons(params: { search: string; limit: number }) {
    const { search, limit } = params;
    if (!search || search.trim().length < 3) {
      return [];
    }
    const term = search.trim();
    return this.prisma.salon.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async findSalonsWithServices() {
    return this.prisma.salon.findMany({
      include: {
        Service: {
          include: {
            service_categories: true,
            ServiceGroup: true,
          },
        },
        Review: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        User: {
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
          Service: {
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
      const categoryId = parseInt(category, 10);
      if (!Number.isNaN(categoryId)) {
        where.Service = { some: { serviceCategoryId: categoryId } };
      } else {
        where.Service = {
          some: {
            service_categories: {
              name_en: { equals: category, mode: 'insensitive' },
            },
          },
        };
      }
    }

    // Rating filter
    if (minRating > 0) {
      where.Review = {
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
        orderBy = { Review: { _count: 'desc' } };
        break;
      case 'services':
        orderBy = { Service: { _count: 'desc' } };
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
        Service: {
          include: {
            service_categories: true,
            ServiceGroup: true,
          },
        },
        Review: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        User: {
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
        Service: {
          include: {
            ServiceGroup: true,
          },
        },
        Staff: true,
        User: {
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
      // Derive categories from services instead of salon.categoryIds
      const serviceCategoryIds = Array.from(
        new Set(
          salon.Service.map((s: any) => s.serviceCategoryId).filter(Boolean),
        ),
      );
      (salon as any).categories = serviceCategoryIds;
    }
    return salon;
  }

  async createCurrentUserSalon(createSalonDto: CreateSalonDto, userId: string) {
    try {
      // Create salon and subscription in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the salon
        const salon = await prisma.salon.create({
          data: {
            ...createSalonDto,
            ownerId: userId,
          } as any,
          include: {
            Service: {
              include: {
                ServiceGroup: true,
              },
            },
            Staff: true,
            User: {
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

      // Add derived categories from services
      const serviceCategoryIds = Array.from(
        new Set(
          (result as any).services
            .map((s: any) => s.serviceCategoryId)
            .filter(Boolean),
        ),
      );
      (result as any).categories = serviceCategoryIds;

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

    const { ...salonData } = updateSalonDto;

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: {
        ...salonData,
      } as any,
      include: {
        Service: {
          include: {
            ServiceGroup: true,
          },
        },
        Staff: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Add derived categories from services
    const serviceCategoryIds = Array.from(
      new Set(
        (updatedSalon as any).services
          .map((s: any) => s.serviceCategoryId)
          .filter(Boolean),
      ),
    );
    (updatedSalon as any).categories = serviceCategoryIds;

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
        User: {
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
      Review: reviewsCheck.slice(0, 2),
    });

    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        Service: {
          include: {
            service_categories: true,
            ServiceGroup: true,
          },
        },
        Staff: true,
        Review: {
          include: {
            User: {
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
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Load all service groups for this salon separately to ensure all groups are available
    const allGroups = await this.prisma.serviceGroup.findMany({
      where: { salonId: id, isActive: true },
      orderBy: { position: 'asc' },
    });

    console.log('SalonsService.findById result:', {
      salonId: salon?.id,
      salonName: salon?.name,
      servicesCount: salon?.Service?.length || 0,
      servicesWithGroups:
        salon?.Service?.filter((s: any) => s.ServiceGroup)?.length || 0,
      groupsCount: allGroups.length,
      groups: allGroups.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
      })),
      reviewsCount: salon?.Review?.length || 0,
    });

    if (!salon) {
      return null;
    }

    // Create a map of service groups by ID for quick lookup
    const groupsMap = new Map<string, any>();
    allGroups.forEach((group) => {
      groupsMap.set(group.id, group);
    });

    // Also add groups from services if they're not already in the map
    (salon.Service || []).forEach((service: any) => {
      if (
        service.ServiceGroup &&
        service.serviceGroupId &&
        !groupsMap.has(service.serviceGroupId)
      ) {
        groupsMap.set(service.serviceGroupId, service.ServiceGroup);
      }
    });

    // Transform Prisma response to frontend format
    const transformedSalon = {
      ...salon,
      services: (salon.Service || []).map((service: any) => {
        const transformedService: any = {
          id: service.id,
          name: service.name,
          description: service.description,
          nameEn: service.nameEn,
          nameVi: service.nameVi,
          nameRu: service.nameRu,
          descriptionEn: service.descriptionEn,
          descriptionVi: service.descriptionVi,
          descriptionRu: service.descriptionRu,
          duration: service.duration,
          price: service.price,
          salonId: service.salonId,
          categoryId: service.categoryId,
          serviceCategoryId: service.serviceCategoryId,
          serviceGroupId: service.serviceGroupId,
        };

        if (service.service_categories) {
          transformedService.serviceCategory = {
            id: service.service_categories.id,
            nameEn: service.service_categories.name_en,
            nameVn: service.service_categories.name_vn,
            nameRu: service.service_categories.name_ru,
          };
        }

        // Use ServiceGroup from service if available, otherwise lookup from map
        const serviceGroup =
          service.ServiceGroup ||
          (service.serviceGroupId
            ? groupsMap.get(service.serviceGroupId)
            : null);
        if (serviceGroup) {
          transformedService.serviceGroup = {
            id: serviceGroup.id,
            salonId: serviceGroup.salonId,
            name: serviceGroup.name,
            description: serviceGroup.description,
            position: serviceGroup.position,
            isActive: serviceGroup.isActive,
            createdAt:
              serviceGroup.createdAt?.toISOString() || new Date().toISOString(),
          };
        }

        return transformedService;
      }),
      staff: (salon.Staff || []).map((staff: any) => ({
        ...staff,
        Staff: undefined,
      })),
      reviews: (salon.Review || []).map((review: any) => ({
        ...review,
        user: review.User
          ? {
              id: review.User.id,
              name: review.User.name,
              email: review.User.email,
            }
          : undefined,
        User: undefined,
      })),
      owner: salon.User
        ? {
            id: salon.User.id,
            name: salon.User.name,
            email: salon.User.email,
          }
        : undefined,
      // Add derived categories from services
      categories: Array.from(
        new Set(
          (salon.Service || [])
            .map((s: any) => s.serviceCategoryId)
            .filter(Boolean),
        ),
      ),
    };

    // Remove Prisma-specific fields
    delete (transformedSalon as any).Service;
    delete (transformedSalon as any).Staff;
    delete (transformedSalon as any).Review;
    delete (transformedSalon as any).User;

    return transformedSalon as any;
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
      where.Review = {
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
          _count: true,
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
    const salons = await this.prisma.salon.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        logo: true,
        photos: true,
        Service: {
          select: {
            price: true,
            service_categories: {
              select: {
                name_en: true,
                name_vn: true,
              },
            },
          },
        },
        Review: {
          select: {
            rating: true,
          },
        },
        _count: true,
      },
      // Do not hard-filter by rating; we will sort by avg rating and reviews count
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get coordinates for salons with addresses
    const salonsWithCoordinates = await Promise.all(
      salons.map(async (salon) => {
        let coordinates: { latitude: number; longitude: number } | null = null;
        if (salon.address) {
          coordinates = await this.geocodingCache.getCoordinates(salon.address);
        }

        return {
          ...salon,
          latitude: coordinates?.latitude ?? undefined,
          longitude: coordinates?.longitude ?? undefined,
        };
      }),
    );

    // Calculate average rating and price range for each salon
    const enriched = salonsWithCoordinates.map((salon) => {
      const avgRating =
        salon.Review.length > 0
          ? salon.Review.reduce((sum, r) => sum + r.rating, 0) /
            salon.Review.length
          : 0;

      // Extract unique categories from services
      const categories = Array.from(
        new Set(
          salon.Service.map(
            (s) =>
              s.service_categories?.name_en || s.service_categories?.name_vn,
          ).filter(Boolean),
        ),
      );

      // Calculate price range
      const prices = salon.Service.map((s) => s.price).filter((p) => p > 0);
      let priceRange = '$$';
      if (prices.length > 0) {
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        if (avgPrice < 200000) {
          priceRange = '$';
        } else if (avgPrice > 500000) {
          priceRange = '$$$';
        }
      }

      return {
        id: salon.id,
        name: salon.name,
        address: salon.address,
        latitude: salon.latitude,
        longitude: salon.longitude,
        logo: salon.logo,
        photos: salon.photos,
        avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        categories,
        priceRange,
        _count: salon._count,
      };
    });

    // Sort by avgRating desc, then by reviews count desc, then by newest
    enriched.sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      const br = (b._count?.Review || 0) - (a._count?.Review || 0);
      if (br !== 0) return br;
      return 0;
    });

    return enriched.slice(0, limit);
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
        _count: true,
      },
      where: {
        Review: {
          some: {
            rating: { gte: 4.0 },
          },
        },
      },
      orderBy: {
        Review: {
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
