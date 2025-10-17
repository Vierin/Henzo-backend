import { Module } from '@nestjs/common';
import { GeocodingCacheService } from '../services/geocoding-cache.service';

@Module({
  providers: [GeocodingCacheService],
  exports: [GeocodingCacheService],
})
export class GeocodingModule {}
