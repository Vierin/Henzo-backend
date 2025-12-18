import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.findMany({
      where: { salonId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accessLevel: true,
        salonId: true,
        Service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            // Убираем description - не нужен для списка
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accessLevel: true,
        salonId: true,
        Service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            description: true,
            // Полные данные для деталей
          },
        },
        Salon: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            // Убираем другие поля - не нужны для деталей сотрудника
          },
        },
      },
    });
  }

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    accessLevel: 'ADMIN' | 'EMPLOYEE';
    salonId: string;
  }) {
    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accessLevel: true,
        salonId: true,
        Service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      accessLevel?: 'ADMIN' | 'EMPLOYEE';
    },
  ) {
    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accessLevel: true,
        salonId: true,
        Service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.staff.delete({
      where: { id },
    });
  }
}
