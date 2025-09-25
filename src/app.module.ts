import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SalonsModule } from './salons/salons.module';
import { StaffModule } from './staff/staff.module';
import { ServicesModule } from './services/services.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthModule } from './auth/auth.module';
import { ReviewsModule } from './reviews/reviews.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { BookingsModule } from './bookings/bookings.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    PrismaModule,
    SalonsModule,
    StaffModule,
    ServicesModule,
    CategoriesModule,
    AuthModule,
    ReviewsModule,
    GeocodingModule,
    BookingsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
