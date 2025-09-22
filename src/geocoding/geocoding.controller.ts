import { Controller, Get, Query } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get()
  async geocodeAddress(@Query('address') address: string) {
    if (!address) {
      return { error: 'Address is required' };
    }

    const result = await this.geocodingService.geocodeAddress(address);
    return result || { error: 'Address not found' };
  }
}
