import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: {
        Staff: true,
        service_categories: true,
        ServiceSubcategory: true,
        Tags: true,
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
        ServiceSubcategory: true,
        Tags: true,
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
        ServiceSubcategory: true,
        Tags: true,
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
    serviceSubcategoryId?: number;
    serviceGroupId?: string;
    tagIds?: number[];
  }) {
    const { tagIds, ...serviceData } = data;
    return this.prisma.service.create({
      data: {
        ...serviceData,
        Tags:
          tagIds && tagIds.length > 0
            ? {
                connect: tagIds.map((id) => ({ id })),
              }
            : undefined,
      },
      include: {
        Staff: true,
        service_categories: true,
        ServiceSubcategory: true,
        Tags: true,
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
      serviceSubcategoryId?: number | null;
      serviceGroupId?: string | null;
      tagIds?: number[];
    },
  ) {
    const { tagIds, ...serviceData } = data;
    return this.prisma.service.update({
      where: { id },
      data: {
        ...serviceData,
        Tags:
          tagIds !== undefined
            ? {
                set: tagIds.map((tagId) => ({ id: tagId })),
              }
            : undefined,
      },
      include: {
        Staff: true,
        service_categories: true,
        ServiceSubcategory: true,
        Tags: true,
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
          {
            ServiceSubcategory: {
              OR: [
                {
                  nameEn: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  nameVi: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  nameRu: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
          {
            Tags: {
              some: {
                OR: [
                  {
                    nameEn: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                  {
                    nameVi: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                  {
                    nameRu: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
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
        ServiceSubcategory: true,
        Tags: true,
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

  async getSubcategoriesByCategory(categoryId: number) {
    return this.prisma.serviceSubcategory.findMany({
      where: { categoryId },
      orderBy: { nameEn: 'asc' },
    });
  }

  async getTags(query?: string, limit: number = 50) {
    const where = query
      ? {
          OR: [
            { nameEn: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { nameVi: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { nameRu: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};
    return this.prisma.serviceTag.findMany({
      where,
      orderBy: { nameEn: 'asc' },
      take: limit,
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
