import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: {
        staff: true,
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        staff: true,
        salon: true,
      },
    });
  }

  async findAllPublic() {
    return this.prisma.service.findMany({
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    duration: number;
    price: number;
    salonId: string;
    categoryId?: string;
  }) {
    return this.prisma.service.create({
      data,
      include: {
        staff: true,
        category: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      duration?: number;
      price?: number;
    },
  ) {
    return this.prisma.service.update({
      where: { id },
      data,
      include: {
        staff: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.service.delete({
      where: { id },
    });
  }
}
