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

  async getCurrentUserSalon() {
    // Временное решение - возвращаем первый салон
    // В реальном приложении здесь будет аутентификация пользователя
    const salon = await this.prisma.salon.findFirst({
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

    return { salon };
  }

  async createCurrentUserSalon(createSalonDto: CreateSalonDto) {
    // Временное решение - создаем салон для первого пользователя
    // В реальном приложении здесь будет аутентификация пользователя
    const firstUser = await this.prisma.user.findFirst();

    if (!firstUser) {
      throw new Error('No user found');
    }

    const salon = await this.prisma.salon.create({
      data: {
        ...createSalonDto,
        ownerId: firstUser.id,
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

    return { salon };
  }

  async updateCurrentUserSalon(updateSalonDto: UpdateSalonDto) {
    // Временное решение - обновляем первый салон
    // В реальном приложении здесь будет аутентификация пользователя
    const existingSalon = await this.prisma.salon.findFirst();

    if (!existingSalon) {
      throw new Error('Salon not found');
    }

    const updatedSalon = await this.prisma.salon.update({
      where: { id: existingSalon.id },
      data: updateSalonDto,
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

    return { salon: updatedSalon };
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
