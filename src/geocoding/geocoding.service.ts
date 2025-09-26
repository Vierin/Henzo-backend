import { Injectable } from '@nestjs/common';

@Injectable()
export class GeocodingService {
  async geocodeAddress(
    address: string,
  ): Promise<{ lat: number; lon: number; display_name: string } | null> {
    try {
      console.log('🔍 Geocoding address:', address);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Henzo Salon Booking App',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('❌ Nominatim API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Geocoding successful:', {
          lat: result.lat,
          lon: result.lon,
          display_name: result.display_name,
        });

        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name,
        };
      } else {
        console.warn('⚠️ No geocoding results found for:', address);
        return null;
      }
    } catch (error) {
      console.error('❌ Error geocoding address:', error);
      return null;
    }
  }

  async reverseGeocode(
    lat: number,
    lon: number,
  ): Promise<{ lat: number; lon: number; display_name: string } | null> {
    try {
      console.log('🔍 Reverse geocoding coordinates:', { lat, lon });

      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Henzo Salon Booking App',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('❌ Nominatim reverse API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (data && data.display_name) {
        console.log('✅ Reverse geocoding successful:', {
          lat: data.lat,
          lon: data.lon,
          display_name: data.display_name,
        });

        return {
          lat: parseFloat(data.lat),
          lon: parseFloat(data.lon),
          display_name: data.display_name,
        };
      } else {
        console.warn('⚠️ No reverse geocoding results found for:', {
          lat,
          lon,
        });
        return null;
      }
    } catch (error) {
      console.error('❌ Error reverse geocoding coordinates:', error);
      return null;
    }
  }
}
