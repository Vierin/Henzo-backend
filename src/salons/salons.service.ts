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

  async getSalonCategories() {
    return this.prisma.salonCategory.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async getCurrentUserSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: {
        ownerId: userId,
      },
      include: {
        services: true,
        staff: true,
        salonCategories: true,
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

      const { salonCategories, ...salonData } = createSalonDto;

      const salon = await this.prisma.salon.create({
        data: {
          ...salonData,
          ownerId: userId,
          salonCategories: salonCategories
            ? {
                connect: salonCategories.map((id) => ({ id })),
              }
            : undefined,
        },
        include: {
          services: true,
          staff: true,
          salonCategories: true,
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

    const { salonCategories, ...salonData } = updateSalonDto;

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: {
        ...salonData,
        salonCategories: salonCategories
          ? {
              set: salonCategories.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        services: true,
        staff: true,
        salonCategories: true,
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
