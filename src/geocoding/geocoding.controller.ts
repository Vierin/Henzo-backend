import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  async searchAddress(@Query('address') address: string) {
    if (!address || address.trim().length === 0) {
      throw new HttpException('Address parameter is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.geocodingService.geocodeAddress(address);
      
      if (!result) {
        throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('❌ Geocoding controller error:', error);
      throw new HttpException(
        error.message || 'Failed to geocode address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}