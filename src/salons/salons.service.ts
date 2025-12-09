import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';
import { MapboxService } from '../mapbox/mapbox.service';
import { TranslationService } from '../services/translation.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SalonsService {
  constructor(
    private prisma: PrismaService,
    private mapboxService: MapboxService,
    private translationService: TranslationService,
    @Inject(CacheService) private cacheService: CacheService,
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
    try {
      // Try cache first
      const cacheKey = 'salons:with-services:all';
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const salons = await this.prisma.salon.findMany({
        include: {
          _count: {
            // P1: Используем _count вместо загрузки всех записей
            select: {
              Review: true,
              Service: true,
              Booking: true,
            },
          },
          Service: {
            take: 3, // Limit to 3 services per salon for card display
            include: {
              service_categories: {
                select: {
                  id: true,
                  name_en: true,
                  name_vn: true,
                  name_ru: true,
                },
              },
              ServiceGroup: {
                select: {
                  id: true,
                  name: true,
                  nameEn: true,
                  nameVi: true,
                  nameRu: true,
                  position: true,
                },
              },
            },
          },
          Review: {
            take: 10, // Limit reviews to avoid huge payload
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
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // P0: Максимальный лимит для предотвращения огромных payloads
      });

      // Transform to match expected format
      const transformedSalons = salons.map((salon: any) => ({
        ...salon,
        services: (salon.Service || []).map((service: any) => ({
          ...service,
          serviceCategory: service.service_categories
            ? {
                id: service.service_categories.id,
                nameEn: service.service_categories.name_en,
                nameVn: service.service_categories.name_vn,
                nameRu: service.service_categories.name_ru,
              }
            : null,
          serviceGroup: service.ServiceGroup || null,
        })),
        Service: undefined, // Remove Prisma field
        reviews: salon.Review || [],
        Review: undefined, // Remove Prisma field
        owner: salon.User || null,
        User: undefined, // Remove Prisma field
        // Add derived categories from services
        categories: Array.from(
          new Set(
            (salon.Service || [])
              .map((s: any) => s.serviceCategoryId)
              .filter(Boolean),
          ),
        ),
      }));

      // Cache result for 15 minutes (900 seconds)
      await this.cacheService.set(cacheKey, transformedSalons, 900);

      return transformedSalons;
    } catch (error) {
      console.error('❌ Error in findSalonsWithServices:', error);
      console.error('Error details:', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw new Error(`Failed to fetch salons with services: ${error.message}`);
    }
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
      limit: requestedLimit = 20,
      search = '',
      location = '',
      category = '',
      sortBy = 'name',
      minRating = 0,
      isOpenNow = false,
    } = params;

    // P0: Максимальный лимит для предотвращения огромных payloads
    const limit = Math.min(requestedLimit, 50);

    // Generate cache key
    const cacheKey = `salons:search:${JSON.stringify(params)}`;
    
    // Try to get from cache
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Text search - prioritize service name search
    if (search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        // Priority 1: Search by service name (most important)
        {
          Service: {
            some: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { nameEn: { contains: searchTerm, mode: 'insensitive' } },
                { nameVi: { contains: searchTerm, mode: 'insensitive' } },
                { nameRu: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
        // Priority 2: Search by salon name
        { name: { contains: searchTerm, mode: 'insensitive' } },
        // Priority 3: Search by salon description and address
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
        // Priority 4: Search by service description
        {
          Service: {
            some: {
              description: { contains: searchTerm, mode: 'insensitive' },
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
        _count: {
          // P1: Используем _count вместо загрузки всех записей
          select: {
            Review: true,
            Service: true,
            Booking: true,
          },
        },
        Service: {
          take: 10, // P0: Увеличено до 10, но все еще ограничено
          select: {
            id: true,
            name: true,
            nameEn: true,
            nameVi: true,
            nameRu: true,
            description: true,
            duration: true,
            price: true,
            serviceCategoryId: true,
            serviceGroupId: true,
            service_categories: {
              select: {
                id: true,
                name_en: true,
                name_vn: true,
                name_ru: true,
              },
            },
            ServiceGroup: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                nameVi: true,
                nameRu: true,
                position: true,
              },
            },
          },
        },
        Review: {
          take: 10, // P0: Лимит на reviews для предотвращения огромных payloads
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
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
      orderBy,
      skip,
      take: limit,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Transform to match expected format (Service -> services)
    const transformedSalons = salons.map((salon: any) => ({
      ...salon,
      services: (salon.Service || []).map((service: any) => ({
        ...service,
        serviceCategory: service.service_categories
          ? {
              id: service.service_categories.id,
              name_en: service.service_categories.name_en,
              name_vn: service.service_categories.name_vn,
              name_ru: service.service_categories.name_ru,
            }
          : null,
        service_categories: undefined, // Remove Prisma field
        serviceGroup: service.ServiceGroup || null,
        ServiceGroup: undefined, // Remove Prisma field
      })),
      Service: undefined, // Remove Prisma field
      reviews: salon.Review || [],
      Review: undefined, // Remove Prisma field
      owner: salon.User || null,
      User: undefined, // Remove Prisma field
    }));

    const result = {
      data: transformedSalons,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };

    // Cache result for 10 minutes (600 seconds)
    await this.cacheService.set(cacheKey, result, 600);

    return result;
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
      // Check if salon already exists for this user
      const existingSalon = await this.prisma.salon.findFirst({
        where: { ownerId: userId },
      });

      if (existingSalon) {
        throw new Error('User already has a salon');
      }

      // Geocode address if provided and coordinates not provided
      let latitude = createSalonDto.latitude;
      let longitude = createSalonDto.longitude;

      if (createSalonDto.address && !latitude && !longitude) {
        try {
          const geocodeResult = await this.mapboxService.geocodeAddress(
            createSalonDto.address,
            'VN',
          );
          if (geocodeResult) {
            latitude = geocodeResult.lat;
            longitude = geocodeResult.lon;
          }
        } catch (error) {
          console.error('⚠️ Failed to geocode address:', error);
          // Continue without coordinates
        }
      }

      // Generate translations for description if provided
      let descriptionTranslations: {
        descriptionEn?: string;
        descriptionVi?: string;
        descriptionRu?: string;
      } = {};

      if (createSalonDto.description && createSalonDto.description.trim()) {
        try {
          console.log('🌐 Generating translations for salon description...');
          const translations =
            await this.translationService.generateDescriptionTranslations(
              createSalonDto.description.trim(),
            );
          descriptionTranslations = {
            descriptionEn: translations.descriptionEn || undefined,
            descriptionVi: translations.descriptionVi || undefined,
            descriptionRu: translations.descriptionRu || undefined,
          };
          console.log('✅ Translations generated:', {
            en: descriptionTranslations.descriptionEn?.substring(0, 50),
            vi: descriptionTranslations.descriptionVi?.substring(0, 50),
            ru: descriptionTranslations.descriptionRu?.substring(0, 50),
          });
        } catch (error) {
          console.error(
            '⚠️ Failed to generate description translations:',
            error,
          );
          // Continue without translations, will use original description
        }
      }

      // Create salon and subscription in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Set default reminder settings if not provided
        const reminderSettings =
          createSalonDto.reminderSettings || { intervals: [24] };

        // Create the salon
        const salon = await prisma.salon.create({
          data: {
            ...createSalonDto,
            reminderSettings,
            ...descriptionTranslations,
            latitude,
            longitude,
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
            updatedAt: now,
          },
        });

        return salon;
      });

      // Add derived categories from services
      // Note: result.Service is an array from Prisma include (may be empty for new salon)
      const services = (result as any).Service || [];
      const serviceCategoryIds = Array.from(
        new Set(services.map((s: any) => s?.serviceCategoryId).filter(Boolean)),
      );
      (result as any).categories = serviceCategoryIds;

      // Transform Service array to services for consistency
      (result as any).services = services;

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

    // Geocode address if provided and coordinates not provided
    let latitude = updateSalonDto.latitude;
    let longitude = updateSalonDto.longitude;

    if (updateSalonDto.address && !latitude && !longitude) {
      try {
        const geocodeResult = await this.mapboxService.geocodeAddress(
          updateSalonDto.address,
          'VN',
        );
        if (geocodeResult) {
          latitude = geocodeResult.lat;
          longitude = geocodeResult.lon;
        }
      } catch (error) {
        console.error('⚠️ Failed to geocode address:', error);
        // Continue without coordinates
      }
    }

    // Generate translations for description if provided and changed
    let descriptionTranslations: {
      descriptionEn?: string;
      descriptionVi?: string;
      descriptionRu?: string;
    } = {};

    if (updateSalonDto.description && updateSalonDto.description.trim()) {
      try {
        console.log(
          '🌐 Generating translations for updated salon description...',
        );
        const translations =
          await this.translationService.generateDescriptionTranslations(
            updateSalonDto.description.trim(),
          );
        descriptionTranslations = {
          descriptionEn: translations.descriptionEn || undefined,
          descriptionVi: translations.descriptionVi || undefined,
          descriptionRu: translations.descriptionRu || undefined,
        };
        console.log('✅ Translations generated for update');
      } catch (error) {
        console.error('⚠️ Failed to generate description translations:', error);
        // Continue without translations
      }
    }

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: {
        ...salonData,
        ...descriptionTranslations,
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
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
        ((updatedSalon as any).Service || [])
          .map((s: any) => s.serviceCategoryId)
          .filter(Boolean),
      ),
    );
    (updatedSalon as any).categories = serviceCategoryIds;

    return updatedSalon; // Возвращаем салон напрямую
  }

  async findById(id: string) {
    try {
      console.log('SalonsService.findById called with id:', id);

      if (!id || id.trim() === '') {
        throw new Error('Salon ID is required');
      }

      // First, let's check if salon exists at all
      const salonExists = await this.prisma.salon.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      console.log('Salon exists check:', salonExists);

      if (!salonExists) {
        console.log('❌ Salon not found with id:', id);
        return null;
      }

      // P1: Используем _count вместо загрузки всех reviews для проверки
      const reviewsCount = await this.prisma.review.count({
        where: { salonId: id },
      });
      console.log('Reviews count for salon:', {
        salonId: id,
        reviewsCount,
      });

      const salon = await this.prisma.salon.findUnique({
        where: { id },
        include: {
          _count: {
            // P1: Используем _count вместо загрузки всех записей
            select: {
              Review: true,
              Service: true,
              Booking: true,
              Staff: true,
            },
          },
          Service: {
            // P0: Лимит на services (максимум 50)
            take: 50,
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              description: true,
              descriptionEn: true,
              descriptionVi: true,
              descriptionRu: true,
              duration: true,
              price: true,
              serviceCategoryId: true,
              serviceGroupId: true,
              service_categories: {
                select: {
                  id: true,
                  name_en: true,
                  name_vn: true,
                  name_ru: true,
                },
              },
              ServiceGroup: {
                select: {
                  id: true,
                  name: true,
                  nameEn: true,
                  nameVi: true,
                  nameRu: true,
                  position: true,
                },
              },
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              accessLevel: true,
            },
          },
          Review: {
            take: 20, // P0: Лимит на reviews (было 50, уменьшено)
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
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
      servicesCount: ((salon as any)?.Service || []).length,
      servicesWithGroups:
        ((salon as any)?.Service || []).filter((s: any) => s.ServiceGroup)?.length || 0,
      groupsCount: allGroups.length,
      groups: allGroups.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
      })),
      reviewsCount: ((salon as any)?.Review || []).length,
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
    ((salon as any).Service || []).forEach((service: any) => {
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
      services: ((salon as any).Service || []).map((service: any) => {
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
            nameEn: serviceGroup.nameEn,
            nameVi: serviceGroup.nameVi,
            nameRu: serviceGroup.nameRu,
            position: serviceGroup.position,
            isActive: serviceGroup.isActive,
            createdAt:
              serviceGroup.createdAt?.toISOString() || new Date().toISOString(),
          };
        }

        return transformedService;
      }),
      staff: ((salon as any).Staff || []).map((staff: any) => ({
        ...staff,
        Staff: undefined,
      })),
      reviews: ((salon as any).Review || []).map((review: any) => ({
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
      owner: (salon as any).User
        ? {
            id: (salon as any).User.id,
            name: (salon as any).User.name,
            email: (salon as any).User.email,
          }
        : undefined,
      // Add derived categories from services
      categories: Array.from(
        new Set(
          ((salon as any).Service || [])
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
    } catch (error) {
      console.error('❌ Error in findById:', error);
      console.error('Error details:', {
        id,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
      });
      
      // Re-throw with more context
      const errorMessage = error.message || 'Unknown error';
      const enhancedError = new Error(`Failed to fetch salon (${id}): ${errorMessage}`);
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
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
        latitude: true,
        longitude: true,
        logo: true,
        photos: true,
        Service: {
          select: {
            id: true,
            price: true,
            serviceCategoryId: true,
            service_categories: {
              select: {
                id: true,
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
        _count: {
          select: {
            Service: true,
            Review: true,
          },
        },
      },
      // Do not hard-filter by rating; we will sort by avg rating and reviews count
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Salons already have coordinates from the database
    const salonsWithCoordinates = salons.map((salon) => ({
      ...salon,
      latitude: salon.latitude ?? undefined,
      longitude: salon.longitude ?? undefined,
    }));

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
        services: salon.Service.map((s: any) => ({
          id: s.id,
          serviceCategoryId: s.serviceCategoryId,
          price: s.price,
        })),
        _count: {
          Service: salon._count?.Service || salon.Service?.length || 0,
          Review: salon._count?.Review || salon.Review?.length || 0,
        },
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

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async findNearbySalons(params: {
    lat?: number;
    lng?: number;
    radius: number;
    limit: number;
  }) {
    const { lat, lng, radius, limit } = params;

    // If no coordinates provided, return featured salons
    if (!lat || !lng) {
      return this.findFeaturedSalons(limit);
    }

    // Get all salons with coordinates
    const salons = await this.prisma.salon.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        logo: true,
        photos: true,
        _count: {
          select: {
            Review: true,
            Booking: true,
          },
        },
      },
    });

    // Calculate distances and filter by radius
    const salonsWithDistance = salons
      .map((salon) => {
        if (!salon.latitude || !salon.longitude) {
          return null;
        }
        const distance = this.calculateDistance(
          lat,
          lng,
          salon.latitude,
          salon.longitude,
        );
        return {
          ...salon,
          distance,
        };
      })
      .filter(
        (salon): salon is NonNullable<typeof salon> =>
          salon !== null && salon.distance <= radius,
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return salonsWithDistance;
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
