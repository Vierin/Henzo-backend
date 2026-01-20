import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsScheduler {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly prisma: PrismaService,
  ) {}

  // P2: Выполняем batch update статусов в фоновой задаче каждые 30 минут
  // Это освобождает основной запрос от необходимости обновлять статусы
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updatePastBookingsStatus() {
    console.log('🕐 Running batch update for past bookings status...');

    try {
      const now = new Date();
      
      // Находим все салоны
      const salons = await this.prisma.salon.findMany({
        select: { id: true },
      });

      if (salons.length === 0) {
        console.log('ℹ️ No salons found, skipping batch update');
        return;
      }

      const salonIds = salons.map((salon) => salon.id);

      // Обновляем все прошедшие бронирования со статусом PENDING или CONFIRMED
      const result = await this.prisma.booking.updateMany({
        where: {
          salonId: { in: salonIds },
          status: { in: ['PENDING', 'CONFIRMED'] },
          dateTime: { lt: now },
        },
        data: { status: 'COMPLETED' },
      });

      console.log(
        `✅ Batch update completed: ${result.count} bookings updated to COMPLETED status`,
      );
    } catch (error) {
      console.error('❌ Error in batch update for past bookings:', error);
    }
  }
}









