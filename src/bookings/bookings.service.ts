import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async createBooking(data: CreateBookingDto, userId: string) {
    try {
      console.log('📅 Creating booking:', { data, userId });

      // Validate that the service exists and belongs to the salon
      const service = await this.prisma.service.findFirst({
        where: {
          id: data.serviceId,
          salonId: data.salonId,
        },
      });

      if (!service) {
        throw new Error('Service not found or does not belong to this salon');
      }

      // Create booking
      const booking = await this.prisma.booking.create({
        data: {
          salonId: data.salonId,
          userId: userId,
          serviceId: data.serviceId,
          staffId: data.staffId,
          time: new Date(data.time),
          status: 'PENDING',
          notes: data.notes,
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
      });

      console.log('✅ Booking created successfully:', booking.id);
      return booking;
    } catch (error) {
      console.error('❌ Error creating booking:', error.message);
      throw error;
    }
  }

  async getUserBookings(userId: string) {
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
        },
        include: {
          service: true,
          staff: true,
          salon: true,
          user: true,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      console.error('❌ Error fetching user bookings:', error.message);
      throw error;
    }
  }

  async getSalonBookings(salonId: string) {
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: salonId,
        },
        include: {
          service: true,
          staff: true,
          user: true,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return bookings;
    } catch (error) {
      console.error('❌ Error fetching salon bookings:', error.message);
      throw error;
    }
  }
}
