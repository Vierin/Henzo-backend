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
        services: true,
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
  async getSalonCategories() {
    return [
      { id: 1, name: 'Hair & Barber' },
      { id: 2, name: 'Tattoo & Piercing' },
      { id: 3, name: 'Massage & Spa' },
      { id: 4, name: 'Manicure & Pedicure' },
      { id: 5, name: 'Cosmetic Medicine' },
      { id: 6, name: 'Other Services' },
    ];
  }

  async getCurrentUserSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: {
        ownerId: userId,
      },
      include: {
        services: true,
        staff: true,
        categoryIds: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return salon;
  }

  async createCurrentUserSalon(createSalonDto: CreateSalonDto, userId: string) {
    try {
      console.log('🔧 Creating salon for user:', userId);
      console.log('📋 Salon data:', JSON.stringify(createSalonDto, null, 2));

      const { categoryIds, ...salonData } = createSalonDto;

      const salon = await this.prisma.salon.create({
        data: {
          ...salonData,
          ownerId: userId,
          categoryIds: categoryIds || [],
        },
        include: {
          services: true,
          staff: true,
          categoryIds: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      console.log('✅ Salon created in database:', salon.id);
      return salon;
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
        categoryIds: categoryIds || existingSalon.categoryIds,
      },
      include: {
        services: true,
        staff: true,
        categoryIds: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedSalon; // Возвращаем салон напрямую
  }

  async findById(id: string) {
    return this.prisma.salon.findUnique({
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
  }
}
