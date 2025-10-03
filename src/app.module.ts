import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SalonsModule } from './salons/salons.module';
import { StaffModule } from './staff/staff.module';
import { ServicesModule } from './services/services.module';
import { AuthModule } from './auth/auth.module';
import { ReviewsModule } from './reviews/reviews.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { BookingsModule } from './bookings/bookings.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { RemindersModule } from './reminders/reminders.module';
import { ContactModule } from './contact/contact.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    PrismaModule,
    SalonsModule,
    StaffModule,
    ServicesModule,
    AuthModule,
    ReviewsModule,
    GeocodingModule,
    BookingsModule,
    EmailModule,
    AdminModule,
    RemindersModule,
    ContactModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
