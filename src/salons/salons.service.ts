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
    const salon = await this.prisma.salon.findUnique({
      where: { id },
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

    if (salon) {
      // Add categories to salon object
      const staticCategories = this.getSalonCategories();
      const salonCategories = staticCategories.filter((cat) =>
        (salon as any).categoryIds.includes(cat.id),
      );
      (salon as any).categories = salonCategories;
    }

    return salon;
  }
}
