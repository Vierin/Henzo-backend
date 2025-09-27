import { Injectable } from '@nestjs/common';

// Helper function to clean address from country indicators
const cleanAddressFromCountry = (address: string): string => {
  return address
    .replace(/,\s*Vietnam$/i, '')
    .replace(/,\s*Việt Nam$/i, '')
    .replace(/,\s*VN$/i, '')
    .replace(/,\s*Viet Nam$/i, '')
    .replace(/\s*Vietnam$/i, '')
    .replace(/\s*Việt Nam$/i, '')
    .replace(/\s*VN$/i, '')
    .replace(/\s*Viet Nam$/i, '')
    .trim();
};

@Injectable()
export class GeocodingService {
  async geocodeAddress(
    address: string,
  ): Promise<{ lat: number; lon: number; display_name: string } | null> {
    try {
      console.log('🔍 Geocoding address:', address);

      // Try multiple search strategies
      const searchVariants = this.generateSearchVariants(address);

      for (let i = 0; i < searchVariants.length; i++) {
        const searchQuery = searchVariants[i];
        console.log(`🔍 Trying search variant ${i + 1}:`, searchQuery);

        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1&countrycodes=vn`;

        const response = await fetch(nominatimUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Henzo Salon Booking App',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          console.error('❌ Nominatim API error:', response.status);
          continue;
        }

        const data = await response.json();

        if (data && data.length > 0) {
          const result = data[0];

          // Remove country name from the end of the address
          const cleanAddress = cleanAddressFromCountry(result.display_name);

          return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            display_name: cleanAddress,
          };
        }

        // Add delay between requests to respect rate limits
        if (i < searchVariants.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.warn(
        '⚠️ No geocoding results found for any variant of:',
        address,
      );
      return null;
    } catch (error) {
      console.error('❌ Error geocoding address:', error);
      return null;
    }
  }

  private generateSearchVariants(address: string): string[] {
    const variants = [address]; // Start with original address

    // Remove house number if present (e.g., "123 Nguyen Hue Street" -> "Nguyen Hue Street")
    const houseNumberPattern = /^\d+\s+/;
    if (houseNumberPattern.test(address)) {
      const withoutNumber = address.replace(houseNumberPattern, '');
      variants.push(withoutNumber);
    }

    // Remove specific building/unit info
    const buildingPattern = /\s+(Apt|Unit|Suite|Building|Blk|Block)\s*\d*/i;
    if (buildingPattern.test(address)) {
      const withoutBuilding = address.replace(buildingPattern, '');
      if (!variants.includes(withoutBuilding)) {
        variants.push(withoutBuilding);
      }
    }

    // Try with just the street name and district
    const parts = address.split(',').map((part) => part.trim());
    if (parts.length >= 2) {
      const streetAndDistrict = `${parts[0]}, ${parts[1]}`;
      if (!variants.includes(streetAndDistrict)) {
        variants.push(streetAndDistrict);
      }
    }

    // Try with just the street name
    if (parts.length >= 1) {
      const streetOnly = parts[0];
      if (!variants.includes(streetOnly)) {
        variants.push(streetOnly);
      }
    }

    // Try with district and city only
    if (parts.length >= 3) {
      const districtAndCity = `${parts[1]}, ${parts[2]}`;
      if (!variants.includes(districtAndCity)) {
        variants.push(districtAndCity);
      }
    }

    return variants;
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
