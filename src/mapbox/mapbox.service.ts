import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MapboxService {
  private geocodingClient: any;
  private readonly accessToken: string;
  private initialized: boolean = false;

  constructor(private configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('MAPBOX_ACCESS_TOKEN') || '';

    if (!this.accessToken) {
      console.warn('⚠️ MAPBOX_ACCESS_TOKEN not found in environment variables');
    }
  }

  private initializeClient() {
    if (this.initialized) {
      return;
    }

    try {
      // Use require for CommonJS compatibility - import at runtime
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mapboxSdk = require('@mapbox/mapbox-sdk');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const geocodingService = require('@mapbox/mapbox-sdk/services/geocoding');

      // Initialize Mapbox client - mapboxSdk is a function
      const baseClient = mapboxSdk({ accessToken: this.accessToken });
      this.geocodingClient = geocodingService(baseClient);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Mapbox client:', error);
      throw error;
    }
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(
    address: string,
    country?: string,
  ): Promise<{ lat: number; lon: number; address: string } | null> {
    try {
      if (!this.accessToken) {
        throw new Error('MAPBOX_ACCESS_TOKEN is not configured');
      }

      this.initializeClient();

      console.log('🔍 Mapbox geocoding address:', address);

      // Limit search to Vietnam by default
      const countryCode = country || 'VN';

      const response = await this.geocodingClient
        .forwardGeocode({
          query: address,
          limit: 1,
          countries: [countryCode],
        })
        .send();

      if (
        response.body &&
        response.body.features &&
        response.body.features.length > 0
      ) {
        const feature = response.body.features[0];
        const [lon, lat] = feature.center;
        const placeName = feature.place_name || address;

        console.log('✅ Mapbox geocoding successful:', {
          original: address,
          found: placeName,
          lat,
          lon,
        });

        return {
          lat,
          lon,
          address: placeName,
        };
      }

      console.warn('⚠️ No Mapbox geocoding results found for:', address);
      return null;
    } catch (error) {
      console.error('❌ Error geocoding address with Mapbox:', error);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(
    lat: number,
    lon: number,
  ): Promise<{ lat: number; lon: number; address: string } | null> {
    try {
      if (!this.accessToken) {
        throw new Error('MAPBOX_ACCESS_TOKEN is not configured');
      }

      this.initializeClient();

      console.log('🔍 Mapbox reverse geocoding coordinates:', { lat, lon });

      const response = await this.geocodingClient
        .reverseGeocode({
          query: [lon, lat],
          limit: 1,
        })
        .send();

      if (
        response.body &&
        response.body.features &&
        response.body.features.length > 0
      ) {
        const feature = response.body.features[0];
        const placeName = feature.place_name || '';

        console.log('✅ Mapbox reverse geocoding successful:', {
          lat,
          lon,
          address: placeName,
        });

        return {
          lat,
          lon,
          address: placeName,
        };
      }

      console.warn('⚠️ No Mapbox reverse geocoding results found for:', {
        lat,
        lon,
      });
      return null;
    } catch (error) {
      console.error('❌ Error reverse geocoding with Mapbox:', error);
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions for address search
   */
  async getAutocompleteSuggestions(
    query: string,
    country?: string,
    limit: number = 5,
  ): Promise<Array<{ id: string; address: string; lat: number; lon: number }>> {
    try {
      if (!this.accessToken) {
        throw new Error('MAPBOX_ACCESS_TOKEN is not configured');
      }

      this.initializeClient();

      const countryCode = country || 'VN';

      const response = await this.geocodingClient
        .forwardGeocode({
          query,
          limit,
          countries: [countryCode],
          types: ['address', 'poi'], // Limit to addresses and points of interest
        })
        .send();

      if (response.body && response.body.features) {
        return response.body.features.map((feature) => ({
          id: feature.id,
          address: feature.place_name || '',
          lat: feature.center[1],
          lon: feature.center[0],
        }));
      }

      return [];
    } catch (error) {
      console.error(
        '❌ Error getting autocomplete suggestions from Mapbox:',
        error,
      );
      return [];
    }
  }
}
