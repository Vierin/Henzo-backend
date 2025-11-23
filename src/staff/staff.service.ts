import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async findBySalonId(salonId: string) {
    return this.prisma.staff.findMany({
      where: { salonId },
      include: {
        Service: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.staff.findUnique({
      where: { id },
      include: {
        Service: true,
        Salon: true,
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
    return this.prisma.staff.create({
      data,
      include: {
        Service: true,
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
    return this.prisma.staff.update({
      where: { id },
      data,
      include: {
        Service: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.staff.delete({
      where: { id },
    });
  }
}
