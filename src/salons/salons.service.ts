import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';
import { MapboxService } from '../mapbox/mapbox.service';
import { TranslationService } from '../services/translation.service';
import { CacheService } from '../cache/cache.service';
import { generateSalonSlug } from '../utils/slug';
import { nanoid } from 'nanoid';

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
        status: 'ACTIVE', // Only suggest active salons
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
        where: {
          status: 'ACTIVE', // Only show active salons in public listings
        },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          instagram: true,
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
          slug: true,
          timezone: true,
          _count: {
            select: {
              Review: true,
              Service: true,
              Booking: true,
            },
          },
          Service: {
            take: 3, // Limit to 3 services per salon for card display
            select: {
              id: true,
              name: true,
              description: true,
              duration: true,
              price: true,
              salonId: true,
              categoryId: true,
              serviceCategoryId: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              descriptionEn: true,
              descriptionVi: true,
              descriptionRu: true,
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
                  isActive: true,
                },
              },
            },
          },
          Review: {
            take: 10, // Limit reviews to avoid huge payload
            select: {
              id: true,
              salonId: true,
              userId: true,
              bookingId: true,
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
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // P0: Максимальный лимит для предотвращения огромных payloads
      });

      // Transform to match expected format
      const transformedSalons = salons.map((salon: any) => ({
        ...salon,
        services: (salon.Service || []).map((service: any) => {
          const transformedService: any = {
            ...service,
            serviceCategory: service.service_categories
              ? {
                  id: service.service_categories.id,
                  nameEn: service.service_categories.name_en,
                  nameVn: service.service_categories.name_vn,
                  nameRu: service.service_categories.name_ru,
                }
              : null,
          };

          // Ensure serviceGroup has correct id
          if (service.ServiceGroup) {
            const groupId = service.ServiceGroup.id || service.serviceGroupId;
            if (groupId) {
              transformedService.serviceGroup = {
                ...service.ServiceGroup,
                id: groupId,
                isActive: service.ServiceGroup.isActive !== false,
              };
            } else {
              transformedService.serviceGroup = null;
            }
          } else {
            transformedService.serviceGroup = null;
          }

          return transformedService;
        }),
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
    date?: string;
    time?: string;
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
      date,
      time,
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
    const where: any = {
      status: 'ACTIVE', // Only show active salons in public search
    };

    // Build category service filter first (needed for combining with search)
    let categoryServiceFilter: any = null;
    if (category && category !== 'all') {
      const categoryId = parseInt(category, 10);

      if (!Number.isNaN(categoryId)) {
        // Numeric ID - treat as serviceCategoryId for backward compatibility
        categoryServiceFilter = { serviceCategoryId: categoryId };
      } else {
        // String - check if it's a main category slug (e.g., "hair-barber", "massage-spa")
        const mainCategories = this.getSalonCategories();
        const mainCategory = mainCategories.find(
          (cat) => cat.slug === category,
        );

        if (mainCategory) {
          // Filter by main_category_id through service_categories JOIN
          categoryServiceFilter = {
            service_categories: {
              main_category_id: mainCategory.id,
            },
          };
        } else {
          // Fallback: filter by service category name
          categoryServiceFilter = {
            service_categories: {
              name_en: { equals: category, mode: 'insensitive' },
            },
          };
        }
      }
    }

    // Text search - combine with category filter if exists
    if (search.trim()) {
      const searchTerm = search.trim();
      const searchOR: any[] = [
        // Priority 2: Search by salon name
        { name: { contains: searchTerm, mode: 'insensitive' } },
        // Priority 3: Search by salon description and address
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
      ];

      // Build service search conditions
      const serviceSearchConditions: any[] = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nameEn: { contains: searchTerm, mode: 'insensitive' } },
        { nameVi: { contains: searchTerm, mode: 'insensitive' } },
        { nameRu: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];

      // Combine service search with category filter if exists
      if (categoryServiceFilter) {
        // Search within specific category
        searchOR.unshift({
          Service: {
            some: {
              AND: [categoryServiceFilter, { OR: serviceSearchConditions }],
            },
          },
        });
      } else {
        // Search in all services
        searchOR.unshift({
          Service: {
            some: {
              OR: serviceSearchConditions,
            },
          },
        });
      }

      where.OR = searchOR;
    } else if (categoryServiceFilter) {
      // Only category filter, no search - apply directly
      where.Service = {
        some: categoryServiceFilter,
      };
    }

    // Location filter - check cities table first
    if (location.trim()) {
      const normalizedLocation = this.normalizeLocationForSearch(location.trim());
      
      // Try to find city in cities table
      const city = await this.prisma.city.findFirst({
        where: {
          isActive: true,
          name: {
            equals: normalizedLocation,
            mode: 'insensitive',
          },
        },
      });

      // Create location variations for better matching
      const locationVariations = new Set<string>();
      locationVariations.add(normalizedLocation);
      locationVariations.add(location.trim());
      
      // If city found in table, add its name to variations
      if (city) {
        locationVariations.add(city.name);
      }

      // Add Vietnamese-English name variations for major cities
      // Da Nang / Đà Nẵng
      if (/đà nẵng|da nang/i.test(normalizedLocation)) {
        locationVariations.add('Da Nang');
        locationVariations.add('Đà Nẵng');
        locationVariations.add('Da Nang, Vietnam');
        locationVariations.add('Đà Nẵng, Vietnam');
      }
      
      // Ho Chi Minh City / Hồ Chí Minh
      if (/hồ chí minh|ho chi minh/i.test(normalizedLocation)) {
        locationVariations.add('Ho Chi Minh City');
        locationVariations.add('Hồ Chí Minh');
        locationVariations.add('Ho Chi Minh City, Vietnam');
        locationVariations.add('Hồ Chí Minh, Vietnam');
        locationVariations.add('Ho Chi Minh');
      }

      // Create address conditions array
      const addressConditions = Array.from(locationVariations).map((loc) => ({
        address: { contains: loc, mode: 'insensitive' as const },
      }));

      // If city found and has coordinates, also search by proximity
      if (city && city.lat && city.lng) {
        // For now, we'll use address matching
        // TODO: Add geospatial search if needed (requires PostGIS)
      }

      // If we already have OR conditions (from search), wrap everything in AND
      if (where.OR) {
        const existingOR = where.OR;
        where.AND = [
          { OR: existingOR },
          { OR: addressConditions },
        ];
        delete where.OR;
      } else {
        // If no OR conditions, use OR for address conditions directly
        where.OR = addressConditions;
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
        // Cannot sort by _count directly, use createdAt as fallback
        // Rating sorting will be done in memory after fetching
        orderBy = { createdAt: 'desc' };
        break;
      case 'services':
        // Cannot sort by _count directly, use createdAt as fallback
        // Service count sorting will be done in memory after fetching
        orderBy = { createdAt: 'desc' };
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
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        instagram: true,
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
        _count: {
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
    let transformedSalons = salons.map((salon: any) => ({
      ...salon,
      services: (salon.Service || []).map((service: any) => {
        const transformedService: any = {
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
        };

        // Ensure serviceGroup has correct id
        if (service.ServiceGroup) {
          const groupId = service.ServiceGroup.id || service.serviceGroupId;
          if (groupId) {
            transformedService.serviceGroup = {
              ...service.ServiceGroup,
              id: groupId,
              isActive: service.ServiceGroup.isActive !== false,
            };
          } else {
            transformedService.serviceGroup = null;
          }
        } else {
          transformedService.serviceGroup = null;
        }

        transformedService.ServiceGroup = undefined; // Remove Prisma field
        return transformedService;
      }),
      Service: undefined, // Remove Prisma field
      reviews: salon.Review || [],
      Review: undefined, // Remove Prisma field
      owner: salon.User || null,
      User: undefined, // Remove Prisma field
    }));

    // Filter salons by date and time if provided
    if (date) {
      const selectedDate = new Date(date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      const isToday = today.getTime() === selectedDay.getTime();

      transformedSalons = transformedSalons.filter((salon: any) => {
        const workingHours = salon.workingHours;
        if (!workingHours || typeof workingHours !== 'object') {
          return true; // If no working hours, assume available
        }

        const dayOfWeek = selectedDate.getDay();
        const dayNames = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ];
        const dayName = dayNames[dayOfWeek];
        const dayHours = workingHours[dayName];

        if (!dayHours || dayHours.closed) {
          return false; // Salon is closed on this day
        }

        // If today, check if salon is still open
        if (isToday) {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;

          const [closeHour, closeMinute] = (dayHours.close || '18:00')
            .split(':')
            .map(Number);
          const closeTimeInMinutes = closeHour * 60 + closeMinute;

          // Salon is closed if current time is past closing time (with 15 min buffer)
          if (currentTimeInMinutes >= closeTimeInMinutes - 15) {
            return false;
          }
        }

        // If time interval is specified, check if it overlaps with working hours
        if (time && time !== 'any') {
          const timeRanges: { [key: string]: { start: string; end: string } } =
            {
              morning: { start: '06:00', end: '12:00' },
              afternoon: { start: '12:00', end: '18:00' },
              evening: { start: '18:00', end: '22:00' },
            };

          const requestedRange = timeRanges[time.toLowerCase()];
          if (requestedRange) {
            const parseTime = (timeStr: string) => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              return hours * 60 + minutes;
            };

            const openMinutes = parseTime(dayHours.open || '09:00');
            const closeMinutes = parseTime(dayHours.close || '18:00');
            const requestStartMinutes = parseTime(requestedRange.start);
            const requestEndMinutes = parseTime(requestedRange.end);

            // Check if time ranges overlap
            const overlaps =
              requestStartMinutes < closeMinutes &&
              requestEndMinutes > openMinutes;

            if (!overlaps) {
              return false;
            }

            // If today, also check if the requested time slot hasn't passed
            if (isToday) {
              const currentTimeInMinutes =
                now.getHours() * 60 + now.getMinutes();
              if (requestEndMinutes <= currentTimeInMinutes + 15) {
                return false; // Requested time slot has already passed
              }
            }
          }
        }

        return true;
      });
    }

    // Sort in memory if needed (for rating and services count)
    if (sortBy === 'rating') {
      transformedSalons.sort((a: any, b: any) => {
        const aReviews = a.reviews || [];
        const bReviews = b.reviews || [];
        const aAvgRating =
          aReviews.length > 0
            ? aReviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
              aReviews.length
            : 0;
        const bAvgRating =
          bReviews.length > 0
            ? bReviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
              bReviews.length
            : 0;
        return bAvgRating - aAvgRating; // Descending
      });
    } else if (sortBy === 'services') {
      transformedSalons.sort((a: any, b: any) => {
        const aCount = (a.services || []).length;
        const bCount = (b.services || []).length;
        return bCount - aCount; // Descending
      });
    }

    // Recalculate total after filtering
    const filteredTotal = transformedSalons.length;
    const filteredTotalPages = Math.ceil(filteredTotal / limit);

    const result = {
      data: transformedSalons,
      pagination: {
        page,
        limit,
        total: date ? filteredTotal : total,
        totalPages: date ? filteredTotalPages : totalPages,
        hasNextPage: date ? page < filteredTotalPages : hasNextPage,
        hasPreviousPage,
      },
    };

    // Cache result for 10 minutes (600 seconds)
    await this.cacheService.set(cacheKey, result, 600);

    return result;
  }

  // Single source of truth for salon categories
  getSalonCategories() {
    return [
      {
        id: 1,
        name: 'Hair & Barber',
        slug: 'hair-barber',
      },
      {
        id: 2,
        name: 'Tattoo & Piercing',
        slug: 'tattoo-piercing',
      },
      {
        id: 3,
        name: 'Massage & Spa',
        slug: 'massage-spa',
      },
      {
        id: 4,
        name: 'Manicure & Pedicure',
        slug: 'manicure-pedicure',
      },
      {
        id: 5,
        name: 'Brows & Lashes',
        slug: 'brows-lashes',
      },
      {
        id: 6,
        name: 'Other Services',
        slug: 'other-services',
      },
    ];
  }

  async getCurrentUserSalon(userId: string) {
    console.log('🔍 Looking for salon for user:', userId);
    const salon = await this.prisma.salon.findFirst({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        instagram: true,
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
        slug: true,
        timezone: true,
        status: true,
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
        const reminderSettings = createSalonDto.reminderSettings || {
          intervals: [24],
        };

        // Create the salon first to get the generated ID
        const salon = await prisma.salon.create({
          data: {
            ...createSalonDto,
            reminderSettings,
            ...descriptionTranslations,
            latitude,
            longitude,
            ownerId: userId,
            status: 'DRAFT', // Set to DRAFT after complete setup
          } as any,
          select: {
            id: true,
            name: true,
            description: true,
            address: true,
            phone: true,
            email: true,
            website: true,
            instagram: true,
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

        // Create BASIC subscription with 3-month trial for the new salon
        const now = new Date();
        const trialEndDate = new Date();
        trialEndDate.setMonth(now.getMonth() + 3); // 3 months trial
        const oneMonthFromTrialEnd = new Date(trialEndDate);
        oneMonthFromTrialEnd.setMonth(trialEndDate.getMonth() + 1);

        await prisma.subscription.create({
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

        // Generate and update slug using the actual salon ID
        const slug = generateSalonSlug(
          salon.name,
          salon.id,
          salon.address || undefined,
        );

        // Update salon with generated slug
        const salonWithSlug = await prisma.salon.update({
          where: { id: salon.id },
          data: { slug },
          select: {
            id: true,
            name: true,
            description: true,
            address: true,
            phone: true,
            email: true,
            website: true,
            instagram: true,
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
            slug: true,
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

        return salonWithSlug;
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
        `✅ Created salon "${result.name}" with BASIC subscription and 3-month trial`,
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
      select: {
        id: true,
        name: true,
        address: true,
        descriptionEn: true,
        descriptionVi: true,
        descriptionRu: true,
      },
    });

    if (!existingSalon) {
      throw new Error('Salon not found');
    }

    // Generate new slug if name or address changed
    let slug: string | undefined;
    if (
      (updateSalonDto.name && updateSalonDto.name !== existingSalon.name) ||
      (updateSalonDto.address &&
        updateSalonDto.address !== existingSalon.address)
    ) {
      slug = generateSalonSlug(
        updateSalonDto.name || existingSalon.name,
        existingSalon.id,
        updateSalonDto.address || existingSalon.address || undefined,
      );
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

    // Generate translations for description only if it changed
    let descriptionTranslations: {
      descriptionEn?: string;
      descriptionVi?: string;
      descriptionRu?: string;
    } = {};

    if (updateSalonDto.description && updateSalonDto.description.trim()) {
      const newDescription = updateSalonDto.description.trim();

      // Check if description actually changed by comparing with existing translations
      const descriptionChanged =
        newDescription !== existingSalon.descriptionEn?.trim() &&
        newDescription !== existingSalon.descriptionVi?.trim() &&
        newDescription !== existingSalon.descriptionRu?.trim();

      if (descriptionChanged) {
        try {
          console.log(
            '🌐 Generating translations for updated salon description...',
          );
          const translations =
            await this.translationService.generateDescriptionTranslations(
              newDescription,
            );
          descriptionTranslations = {
            descriptionEn: translations.descriptionEn || undefined,
            descriptionVi: translations.descriptionVi || undefined,
            descriptionRu: translations.descriptionRu || undefined,
          };
          console.log('✅ Translations generated for update');
        } catch (error) {
          console.error(
            '⚠️ Failed to generate description translations:',
            error,
          );
          // Continue without translations
        }
      } else {
        console.log(
          'ℹ️ Description unchanged, skipping translation generation',
        );
      }
    }

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: {
        ...salonData,
        ...descriptionTranslations,
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(slug && { slug }), // Update slug if generated
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
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          instagram: true,
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
          slug: true,
          timezone: true,
          status: true,
          _count: {
            select: {
              Review: true,
              Service: true,
              Booking: true,
              Staff: true,
            },
          },
          Service: {
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
                  isActive: true,
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
            take: 20,
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
          ((salon as any)?.Service || []).filter((s: any) => s.ServiceGroup)
            ?.length || 0,
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
            // Ensure we use serviceGroupId as fallback if serviceGroup.id is missing
            const groupId = serviceGroup.id || service.serviceGroupId;
            if (groupId) {
              transformedService.serviceGroup = {
                id: groupId,
                salonId: serviceGroup.salonId,
                name: serviceGroup.name,
                nameEn: serviceGroup.nameEn,
                nameVi: serviceGroup.nameVi,
                nameRu: serviceGroup.nameRu,
                position: serviceGroup.position,
                isActive: serviceGroup.isActive !== false, // Default to true if undefined
                createdAt:
                  serviceGroup.createdAt?.toISOString() ||
                  new Date().toISOString(),
              };
            }
          }

          return transformedService;
        }),
        staff: ((salon as any).Staff || []).map((staff: any) => ({
          ...staff,
          Staff: undefined,
        })),
        reviews: ((salon as any).Review || []).map((review: any) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
            ? new Date(review.createdAt).toISOString()
            : new Date().toISOString(),
          user: review.User
            ? {
                id: review.User.id,
                name: review.User.name,
                email: review.User.email,
              }
            : undefined,
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
      const enhancedError = new Error(
        `Failed to fetch salon (${id}): ${errorMessage}`,
      );
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
  }

  /**
   * Find salon by slug - optimized for fast lookups with indexed slug field
   * @param slug - salon slug
   * @returns salon data or null if not found
   */
  async findBySlug(slug: string) {
    try {
      if (!slug || slug.trim() === '') {
        return null;
      }

      // Fast lookup by slug using indexed field
      const salon = await this.prisma.salon.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          instagram: true,
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
          slug: true,
          timezone: true,
          _count: {
            select: {
              Review: true,
              Service: true,
              Booking: true,
              Staff: true,
            },
          },
          Service: {
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
                  isActive: true,
                },
              },
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              accessLevel: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      if (!salon) {
        return null;
      }

      // Load reviews with user information
      const reviews = await this.prisma.review.findMany({
        where: { salonId: salon.id },
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
      });

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      // Load all service groups for this salon separately to ensure all groups are available
      const allGroups = await this.prisma.serviceGroup.findMany({
        where: { salonId: salon.id, isActive: true },
        orderBy: { position: 'asc' },
      });

      // Create a map of service groups by ID for quick lookup
      const groupsMap = new Map<string, any>();
      allGroups.forEach((group) => {
        groupsMap.set(group.id, group);
      });

      // Also add groups from services if they're not already in the map
      salon.Service.forEach((service: any) => {
        if (
          service.ServiceGroup &&
          service.serviceGroupId &&
          !groupsMap.has(service.serviceGroupId)
        ) {
          groupsMap.set(service.serviceGroupId, service.ServiceGroup);
        }
      });

      // Transform to match expected format
      const transformedSalon = {
        ...salon,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: salon._count.Review,
        reviews: reviews.map((review: any) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
            ? new Date(review.createdAt).toISOString()
            : new Date().toISOString(),
          user: review.User
            ? {
                id: review.User.id,
                name: review.User.name,
                email: review.User.email,
              }
            : null,
        })),
        services: salon.Service.map((service: any) => {
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
            // Ensure we use serviceGroupId as fallback if serviceGroup.id is missing
            const groupId = serviceGroup.id || service.serviceGroupId;
            if (groupId) {
              transformedService.serviceGroup = {
                id: groupId,
                salonId: serviceGroup.salonId,
                name: serviceGroup.name,
                nameEn: serviceGroup.nameEn,
                nameVi: serviceGroup.nameVi,
                nameRu: serviceGroup.nameRu,
                position: serviceGroup.position,
                isActive: serviceGroup.isActive !== false, // Default to true if undefined
                createdAt:
                  serviceGroup.createdAt?.toISOString() ||
                  new Date().toISOString(),
              };
            }
          }

          return transformedService;
        }),
        categories: Array.from(
          new Set(
            salon.Service.map((s: any) => s.serviceCategoryId).filter(Boolean),
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
      console.error('❌ Error in findBySlug:', error);
      return null;
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

    // Add status filter for public listings
    const publicWhere = {
      ...where,
      status: 'ACTIVE',
    };

    const [salons, total] = await Promise.all([
      this.prisma.salon.findMany({
        where: publicWhere,
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
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
    // Cache key includes limit to cache different limits separately
    // Version 2: categories are derived from services
    const cacheKey = `salons:featured:v2:${limit}`;

    // Try to get from cache first (24 hours TTL)
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const salons = await this.prisma.salon.findMany({
      where: {
        status: 'ACTIVE', // Only show active salons in featured listings
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
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

    const result = enriched.slice(0, limit);

    // Cache the result for 24 hours (86400000 milliseconds)
    await this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000);

    return result;
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
        status: 'ACTIVE', // Only show active salons
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
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

  /**
   * Normalize location name for search by removing administrative prefixes
   */
  private normalizeLocationForSearch(location: string): string {
    if (!location) return location;

    // Remove common Vietnamese administrative prefixes
    const prefixes = [
      /^Thành phố\s+/i, // City
      /^Tỉnh\s+/i, // Province
      /^Huyện\s+/i, // District
      /^Quận\s+/i, // Urban district
      /^Thị xã\s+/i, // Town
      /^Xã\s+/i, // Commune
      /^Phường\s+/i, // Ward
      /^Thị trấn\s+/i, // Township
    ];

    let cleaned = location.trim();
    for (const prefix of prefixes) {
      cleaned = cleaned.replace(prefix, '');
    }

    return cleaned.trim();
  }
}
