import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    return this.prisma.category.findMany({
      where: { salonId },
      include: {
        services: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        services: true,
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async create(data: { name: string; salonId: string }) {
    return this.prisma.category.create({
      data,
      include: {
        services: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
    },
  ) {
    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        services: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
