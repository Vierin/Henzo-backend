import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapboxService } from './mapbox.service';
import { MapboxController } from './mapbox.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MapboxController],
  providers: [MapboxService],
  exports: [MapboxService],
})
export class MapboxModule {}
