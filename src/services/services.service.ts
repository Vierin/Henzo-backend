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
        serviceCategory: true,
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
        serviceCategory: true,
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
        serviceCategory: true,
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
    serviceCategoryId?: number;
  }) {
    return this.prisma.service.create({
      data,
      include: {
        staff: true,
        serviceCategory: true,
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
      serviceCategoryId?: number;
    },
  ) {
    return this.prisma.service.update({
      where: { id },
      data,
      include: {
        staff: true,
        serviceCategory: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.service.delete({
      where: { id },
    });
  }

  async searchServices(query: string) {
    if (!query || query.trim().length < 3) {
      return [];
    }

    return this.prisma.service.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            serviceCategory: {
              OR: [
                {
                  nameEn: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  nameVn: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        ],
      },
      include: {
        serviceCategory: {
          select: {
            nameEn: true,
            nameVn: true,
          },
        },
        salon: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 10, // Limit to 10 results
    });
  }
}
