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
    serviceIds?: string[];
  }) {
    // Update salon status to READY if it's DRAFT
    const salon = await this.prisma.salon.findUnique({
      where: { id: data.salonId },
      select: { status: true },
    });

    if (salon?.status === 'DRAFT') {
      await this.prisma.salon.update({
        where: { id: data.salonId },
        data: { status: 'READY' },
      });
    }

    // Extract serviceIds from data
    const { serviceIds, ...staffData } = data;

    // If serviceIds is not provided or empty, connect to all services in the salon
    let serviceConnect: { connect: { id: string }[] } | undefined;
    if (serviceIds && serviceIds.length > 0) {
      serviceConnect = {
        connect: serviceIds.map((id) => ({ id })),
      };
    } else {
      // Get all services for the salon
      const allServices = await this.prisma.service.findMany({
        where: { salonId: data.salonId },
        select: { id: true },
      });
      if (allServices.length > 0) {
        serviceConnect = {
          connect: allServices.map((service) => ({ id: service.id })),
        };
      }
    }

    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.create({
      data: {
        ...staffData,
        Service: serviceConnect,
      },
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
      serviceIds?: string[];
    },
  ) {
    // Extract serviceIds from data
    const { serviceIds, ...updateData } = data;

    // Prepare service connection if serviceIds is provided
    let serviceUpdate: { set: { id: string }[] } | undefined;
    if (serviceIds !== undefined) {
      if (serviceIds.length === 0) {
        // If empty array, connect to all services in the salon
        const staff = await this.prisma.staff.findUnique({
          where: { id },
          select: { salonId: true },
        });
        if (staff) {
          const allServices = await this.prisma.service.findMany({
            where: { salonId: staff.salonId },
            select: { id: true },
          });
          serviceUpdate = {
            set: allServices.map((service) => ({ id: service.id })),
          };
        }
      } else {
        serviceUpdate = {
          set: serviceIds.map((serviceId) => ({ id: serviceId })),
        };
      }
    }

    // Важно: Используем select вместо include для уменьшения payload
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...updateData,
        ...(serviceUpdate && { Service: serviceUpdate }),
      },
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
