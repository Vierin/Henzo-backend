import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    // Важно: Используем select вместо include для уменьшения payload
    const services = await this.prisma.service.findMany({
      where: { salonId },
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
        salonId: true,
        serviceCategoryId: true,
        serviceGroupId: true,
        Staff: {
          select: {
            id: true,
            name: true,
            // Убираем email, phone, accessLevel - не нужны для списка
          },
        },
        service_categories: {
          select: {
            id: true,
            name_en: true,
            name_vn: true,
            name_ru: true,
            // Убираем другие поля - не нужны
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
            // Убираем другие поля - не нужны
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform ServiceGroup to serviceGroup for frontend compatibility
    return services.map((service) => ({
      ...service,
      serviceGroup: service.ServiceGroup || null,
      ServiceGroup: undefined,
    }));
  }

  async findById(id: string) {
    // Важно: Используем select вместо include для уменьшения payload
    const service = await this.prisma.service.findUnique({
      where: { id },
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
        salonId: true,
        serviceCategoryId: true,
        serviceGroupId: true,
        Staff: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            // accessLevel не нужен для деталей
          },
        },
        Salon: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            // Убираем другие поля - не нужны для деталей услуги
          },
        },
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
    });

    if (!service) return null;

    // Transform ServiceGroup to serviceGroup for frontend compatibility
    return {
      ...service,
      serviceGroup: service.ServiceGroup || null,
      ServiceGroup: undefined,
    };
  }

  async findAllPublic() {
    const services = await this.prisma.service.findMany({
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

    // Transform ServiceGroup to serviceGroup for frontend compatibility
    return services.map((service) => ({
      ...service,
      serviceGroup: service.ServiceGroup || null,
      ServiceGroup: undefined,
    }));
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
        ServiceGroup: true,
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
        ServiceGroup: true,
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
                {
                  name_ru: {
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
            name_ru: true,
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

  async getServiceCategories() {
    return this.prisma.service_categories.findMany({
      orderBy: { name_en: 'asc' },
    });
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
    nameEn?: string;
    nameVi?: string;
    nameRu?: string;
  }) {
    const count = await this.prisma.serviceGroup.count({
      where: { salonId: data.salonId },
    });
    return this.prisma.serviceGroup.create({
      data: {
        salonId: data.salonId,
        name: data.name,
        nameEn: data.nameEn,
        nameVi: data.nameVi,
        nameRu: data.nameRu,
        position: count * 10,
      },
    });
  }

  async updateGroup(
    id: string,
    data: {
      name?: string;
      nameEn?: string;
      nameVi?: string;
      nameRu?: string;
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
