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
import { TimeBlocksModule } from './time-blocks/time-blocks.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { RemindersModule } from './reminders/reminders.module';
import { ContactModule } from './contact/contact.module';
import { SearchModule } from './search/search.module';
import { InviteCodesModule } from './invite-codes/invite-codes.module';
import { FeedbackModule } from './feedback/feedback.module';
import { NotificationsModule } from './notifications/notifications.module';

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
    TimeBlocksModule,
    EmailModule,
    AdminModule,
    RemindersModule,
    ContactModule,
    SearchModule,
    InviteCodesModule,
    FeedbackModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
