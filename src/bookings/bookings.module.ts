import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsScheduler } from './bookings.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EmailModule,
    ConfigModule,
    NotificationsModule,
    ScheduleModule.forRoot(), // P2: Для фоновых задач
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsScheduler], // P2: Добавляем scheduler
})
export class BookingsModule {}
