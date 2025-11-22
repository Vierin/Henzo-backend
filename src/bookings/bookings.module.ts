import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule, ConfigModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
