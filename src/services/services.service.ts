import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: {
        Staff: true,
        service_categories: true,
        ServiceGroup: true,
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
        Staff: true,
        Salon: true,
        service_categories: true,
        ServiceGroup: true,
      },
    });
  }

  async findAllPublic() {
    return this.prisma.service.findMany({
      include: {
        Salon: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        service_categories: true,
        ServiceGroup: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    nameEn?: string;
    nameVi?: string;
    nameRu?: string;
    descriptionEn?: string;
    descriptionVi?: string;
    descriptionRu?: string;
    duration: number;
    price: number;
    salonId: string;
    serviceCategoryId?: number;
    serviceGroupId?: string;
  }) {
    return this.prisma.service.create({
      data,
      include: {
        Staff: true,
        service_categories: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      nameEn?: string;
      nameVi?: string;
      nameRu?: string;
      descriptionEn?: string;
      descriptionVi?: string;
      descriptionRu?: string;
      duration?: number;
      price?: number;
      serviceCategoryId?: number;
      serviceGroupId?: string | null;
    },
  ) {
    return this.prisma.service.update({
      where: { id },
      data,
      include: {
        Staff: true,
        service_categories: true,
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
            service_categories: {
              OR: [
                {
                  name_en: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  name_vn: {
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
        service_categories: {
          select: {
            name_en: true,
            name_vn: true,
          },
        },
        Salon: {
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

  async findPopularServices(limit: number) {
    // For MVP, return services with most bookings
    // In production, you'd analyze booking frequency
    return this.prisma.service.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        price: true,
        Salon: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        service_categories: {
          select: {
            name_en: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: limit,
    });
  }

  async findTrendingServices(limit: number) {
    // For MVP, return recently created services
    // In production, you'd analyze recent booking trends
    return this.prisma.service.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        price: true,
        Salon: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        service_categories: {
          select: {
            name_en: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: limit,
    });
  }

  getServiceCategories() {
    // Static categories for MVP
    // In production, these would come from database
    return [
      { id: 1, nameEn: 'Hair Services', nameVn: 'Dịch vụ tóc' },
      { id: 2, nameEn: 'Nail Care', nameVn: 'Chăm sóc móng' },
      { id: 3, nameEn: 'Skincare', nameVn: 'Chăm sóc da' },
      { id: 4, nameEn: 'Massage', nameVn: 'Massage' },
      { id: 5, nameEn: 'Barber', nameVn: 'Cắt tóc nam' },
      { id: 6, nameEn: 'Spa', nameVn: 'Spa' },
    ];
  }

  // --- Service groups ---
  async findGroupsBySalon(salonId: string) {
    return this.prisma.serviceGroup.findMany({
      where: { salonId, isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  async createGroup(data: {
    salonId: string;
    name: string;
    description?: string;
  }) {
    const count = await this.prisma.serviceGroup.count({
      where: { salonId: data.salonId },
    });
    return this.prisma.serviceGroup.create({
      data: {
        salonId: data.salonId,
        name: data.name,
        description: data.description,
        position: count * 10,
      },
    });
  }

  async updateGroup(
    id: string,
    data: {
      name?: string;
      description?: string;
      position?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.serviceGroup.update({
      where: { id },
      data,
    });
  }

  async deleteGroup(id: string) {
    // soft delete: mark inactive and detach from services
    return this.prisma.$transaction(async (tx) => {
      await tx.service.updateMany({
        where: { serviceGroupId: id },
        data: { serviceGroupId: null },
      });
      return tx.serviceGroup.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }
}
