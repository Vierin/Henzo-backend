import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InviteCodesModule } from '../invite-codes/invite-codes.module';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [PrismaModule, AuthModule, InviteCodesModule, GeocodingModule],
  controllers: [SalonsController],
  providers: [SalonsService],
})
export class SalonsModule {}
