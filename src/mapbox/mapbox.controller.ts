import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MapboxService } from './mapbox.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('mapbox')
export class MapboxController {
  constructor(
    private readonly mapboxService: MapboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('autocomplete')
  async getAutocompleteSuggestions(
    @Query('q') query: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const limitNum = limit ? parseInt(limit, 10) : 5;
    const suggestions = await this.mapboxService.getAutocompleteSuggestions(
      query.trim(),
      country || 'VN',
      limitNum,
    );

    return suggestions;
  }

  @Public()
  @Get('geocode')
  async geocodeAddress(@Query('address') address: string) {
    if (!address || address.trim().length < 2) {
      return null;
    }

    const result = await this.mapboxService.geocodeAddress(
      address.trim(),
      'VN',
    );
    return result;
  }

  @Public()
  @Get('reverse-geocode')
  async reverseGeocode(@Query('lat') lat: string, @Query('lon') lon: string) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      return null;
    }

    const result = await this.mapboxService.reverseGeocode(latNum, lonNum);
    return result;
  }

  @Public()
  @Get('cities')
  async getCities() {
    const cities = await this.prisma.city.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        countryCode: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform to match AddressSuggestion format
    return cities.map((city) => ({
      id: `city-${city.id}`,
      address: city.name,
      lat: city.lat,
      lon: city.lng,
    }));
  }
}
