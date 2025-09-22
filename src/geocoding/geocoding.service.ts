import { Injectable } from '@nestjs/common';

@Injectable()
export class GeocodingService {
  async geocodeAddress(address: string) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'Henzo Salon Booking App',
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        return {
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          address: display_name,
        };
      }

      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }
}
