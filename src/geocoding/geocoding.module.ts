import { Module } from '@nestjs/common';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { GeocodingCacheService } from '../services/geocoding-cache.service';

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, GeocodingCacheService],
  exports: [GeocodingService, GeocodingCacheService],
})
export class GeocodingModule {}
