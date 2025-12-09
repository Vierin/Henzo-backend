import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MapboxModule } from '../mapbox/mapbox.module';
import { ServicesModule } from '../services/services.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, AuthModule, MapboxModule, ServicesModule, CacheModule],
  controllers: [SalonsController],
  providers: [SalonsService],
})
export class SalonsModule {}
