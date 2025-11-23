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

      // Extract postal code
      const postalCodeMatch = address.match(/\b(\d{5,6})\b/);
      const postalCode = postalCodeMatch ? postalCodeMatch[1] : null;

      if (postalCode) {
        console.log(`📮 Found postal code: ${postalCode}`);
      }

      // Try multiple search strategies
      const searchVariants = this.generateSearchVariants(address);

      for (let i = 0; i < searchVariants.length; i++) {
        const searchQuery = searchVariants[i];
        console.log(
          `🔍 Trying search variant ${i + 1}/${searchVariants.length}:`,
          searchQuery,
        );

        // For more specific searches (with city or postal code), increase limit
        const hasPostalCode = /\b\d{5,6}\b/.test(searchQuery);
        const hasCity =
          searchQuery.includes(',') && searchQuery.split(',').length >= 3;
        // Increase limit to get more results and filter out bad ones
        const limit = hasCity || hasPostalCode ? 10 : 5;
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=${limit}&addressdetails=1&countrycodes=vn&accept-language=vi&extratags=1&namedetails=1`;

        const response = await fetch(nominatimUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Henzo Salon Booking App',
            Accept: 'application/json',
            'Accept-Language': 'vi-VN,vi,en-US,en',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          console.error('❌ Nominatim API error:', response.status);
          continue;
        }

        const data = await response.json();

        if (data && data.length > 0) {
          // Extract city/district keywords and postal code from original address
          const originalParts = address
            .toLowerCase()
            .replace(/,\s*(Vietnam|Wietnam|Việt Nam|VN)\s*$/i, '')
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p);

          const cityKeywords: string[] = [];
          if (originalParts.length >= 3) {
            // City is usually the 3rd part (Nha Trang)
            cityKeywords.push(originalParts[2]);
            // District is usually the 2nd part (Lộc Thọ)
            cityKeywords.push(originalParts[1]);
            // Province is usually the 4th part (Khánh Hòa)
            if (originalParts.length >= 4) {
              cityKeywords.push(originalParts[3]);
            }
          }

          // Find the best match that includes city/district keywords and postal code
          let bestResult = data[0];
          let bestScore = 0;

          for (const result of data) {
            const resultAddr = result.display_name.toLowerCase();
            const resultPostalCode = resultAddr.match(/\b(\d{5,6})\b/)?.[1];
            const addr = result.address || {};

            // Calculate match score based on postal code (highest priority)
            let score = 0;

            // Postal code match is the highest priority
            if (postalCode && resultPostalCode === postalCode) {
              score += 50; // Very high score for postal code match
            }

            // Check postal code in address components
            if (postalCode && addr.postcode === postalCode) {
              score += 50;
            }

            // City/district keywords matching
            for (const keyword of cityKeywords) {
              if (keyword && resultAddr.includes(keyword.toLowerCase())) {
                score += 2;
              }
              // Also check address components
              if (keyword) {
                if (
                  addr.city?.toLowerCase().includes(keyword.toLowerCase()) ||
                  addr.town?.toLowerCase().includes(keyword.toLowerCase()) ||
                  addr.district
                    ?.toLowerCase()
                    .includes(keyword.toLowerCase()) ||
                  addr.state?.toLowerCase().includes(keyword.toLowerCase())
                ) {
                  score += 3;
                }
              }
            }

            // Prefer results with house numbers if original has house number
            if (
              originalParts[0] &&
              /\d+/.test(originalParts[0]) &&
              /\d+/.test(resultAddr)
            ) {
              score += 1;
            }

            if (score > bestScore) {
              bestScore = score;
              bestResult = result;
            }
          }

          console.log(`✅ Best match score: ${bestScore}`, {
            original: address,
            found: bestResult.display_name,
            cityKeywords: cityKeywords,
          });

          // If we have postal code or city keywords but best score is low, continue to next variant
          // But if we found postal code match, use it even if city doesn't match perfectly
          const hasPostalCodeMatch = postalCode && bestScore >= 50;

          if (
            !hasPostalCodeMatch &&
            cityKeywords.length > 0 &&
            bestScore < 2 &&
            i < searchVariants.length - 1
          ) {
            console.log(
              `⚠️ Low match score (${bestScore}) for variant ${i + 1}, trying next...`,
            );
            continue;
          }

          // Remove country name from the end of the address
          let cleanAddress = cleanAddressFromCountry(bestResult.display_name);

          // Remove business names from the start of the address
          cleanAddress = this.removeBusinessNameFromAddress(cleanAddress);

          // Validate that we still have a meaningful address (not just postal code)
          if (
            cleanAddress &&
            /^\d{5,6}(\s*,\s*[^,]+)?$/.test(cleanAddress.trim())
          ) {
            // If result is only postal code, try to use original address structure
            const addr: any = bestResult.address || {};
            if (addr.road || addr.house_number) {
              // Reconstruct address from components
              const parts: string[] = [];
              if (addr.house_number) parts.push(String(addr.house_number));
              if (addr.road) parts.push(String(addr.road));
              if (addr.suburb || addr.neighbourhood)
                parts.push(String(addr.suburb || addr.neighbourhood));
              if (addr.city || addr.town)
                parts.push(String(addr.city || addr.town));
              if (addr.state) parts.push(String(addr.state));
              if (addr.postcode) parts.push(String(addr.postcode));
              if (parts.length > 0) {
                cleanAddress = parts.join(', ');
              }
            }
          }

          console.log(`✅ Geocoding successful:`, {
            original: address,
            found: cleanAddress,
            lat: bestResult.lat,
            lon: bestResult.lon,
          });

          return {
            lat: parseFloat(bestResult.lat),
            lon: parseFloat(bestResult.lon),
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

  private removeBusinessNameFromAddress(address: string): string {
    // Remove business names that appear before address components
    // Pattern: "Business Name, 123 Street" -> "123 Street"

    // Split by comma
    const parts = address.split(',').map((p) => p.trim());

    // Find the first part that looks like an address (starts with number or is a street name)
    const addressPartIndex = parts.findIndex((part, index) => {
      // First part with number is likely the address
      if (/^\d+/.test(part)) return true;

      // Skip first part if it's clearly a business name (doesn't start with number and is short)
      if (
        index === 0 &&
        part.length < 50 &&
        !/^\d+/.test(part) &&
        !/\b(street|đường|road|phố)\b/i.test(part)
      ) {
        // Check if next part starts with number
        if (parts.length > 1 && /^\d+/.test(parts[1])) {
          return false; // This is likely a business name
        }
      }

      return false;
    });

    // If we found an address part, start from there
    if (addressPartIndex > 0) {
      return parts.slice(addressPartIndex).join(', ');
    }

    // If first part doesn't look like address, try to remove it
    if (parts.length > 1) {
      const firstPart = parts[0].toLowerCase();
      // Common business name patterns
      const businessPatterns = [
        /^(pizza|restaurant|cafe|shop|store|salon|spa|hotel|bar|club|market|mall|center|centre|bank|pharmacy)/i,
        /^[a-z\s&]+$/i, // All letters, likely a name
      ];

      // Check if first part looks like a business name
      const looksLikeBusiness = businessPatterns.some((pattern) =>
        pattern.test(firstPart),
      );
      const secondPartHasNumber = /^\d+/.test(parts[1]);

      if (looksLikeBusiness && secondPartHasNumber && parts[0].length < 50) {
        return parts.slice(1).join(', ');
      }
    }

    return address;
  }

  private generateSearchVariants(address: string): string[] {
    // Extract postal code first (5-6 digits)
    const postalCodeMatch = address.match(/\b(\d{5,6})\b/);
    const postalCode = postalCodeMatch ? postalCodeMatch[1] : null;

    // Clean address - remove country but keep postal code for now
    let cleanedAddress = address
      .replace(/,\s*(Vietnam|Wietnam|Việt Nam|VN)\s*$/i, '')
      .trim();

    const variants: string[] = [];

    // Priority 1: Full address with postal code
    if (postalCode && cleanedAddress) {
      // Ensure postal code is at the end
      const addressWithoutPostal = cleanedAddress
        .replace(/\b\d{5,6}\b/, '')
        .trim()
        .replace(/,\s*,/g, ',')
        .replace(/,$/, '');
      if (addressWithoutPostal) {
        variants.push(`${addressWithoutPostal}, ${postalCode}`);
      }
      // Also keep original if it has postal code
      if (cleanedAddress.includes(postalCode)) {
        variants.push(cleanedAddress);
      }
    } else {
      variants.push(cleanedAddress);
    }

    // Keep the original with house number as first priority
    const houseNumberPattern = /^\d+\s+/;
    const hasHouseNumber = houseNumberPattern.test(cleanedAddress);

    // Remove house number variant (for fallback)
    if (hasHouseNumber) {
      const withoutNumber = cleanedAddress
        .replace(houseNumberPattern, '')
        .trim();
      if (withoutNumber && !variants.includes(withoutNumber)) {
        variants.push(withoutNumber);
      }
    }

    // Remove specific building/unit info
    const buildingPattern = /\s+(Apt|Unit|Suite|Building|Blk|Block)\s*\d*/i;
    if (buildingPattern.test(cleanedAddress)) {
      const withoutBuilding = cleanedAddress
        .replace(buildingPattern, '')
        .trim();
      if (withoutBuilding && !variants.includes(withoutBuilding)) {
        variants.push(withoutBuilding);
      }
    }

    // Try with just the street name and district (keep house number if present)
    const parts = cleanedAddress.split(',').map((part) => part.trim());
    if (parts.length >= 2) {
      const streetAndDistrict = `${parts[0]}, ${parts[1]}`;
      if (!variants.includes(streetAndDistrict)) {
        variants.push(streetAndDistrict);
      }
    }

    // Try with street name, district, and city
    if (parts.length >= 3) {
      const streetDistrictCity = `${parts[0]}, ${parts[1]}, ${parts[2]}`;
      if (!variants.includes(streetDistrictCity)) {
        variants.push(streetDistrictCity);
        // Also add with postal code if available
        if (postalCode) {
          variants.push(`${streetDistrictCity}, ${postalCode}`);
        }
      }
    }

    // Try with street + city + postal code (skip district)
    if (parts.length >= 3 && postalCode) {
      const streetCity = `${parts[0]}, ${parts[2]}`;
      const streetCityPostal = `${streetCity}, ${postalCode}`;
      if (!variants.includes(streetCityPostal)) {
        variants.push(streetCityPostal);
      }
    }

    // Try with district + city + postal code
    if (parts.length >= 3 && postalCode) {
      const districtCity = `${parts[1]}, ${parts[2]}`;
      const districtCityPostal = `${districtCity}, ${postalCode}`;
      if (!variants.includes(districtCityPostal)) {
        variants.push(districtCityPostal);
      }
    }

    // Try with just the street name (keep house number if present)
    if (parts.length >= 1) {
      const streetOnly = parts[0];
      if (streetOnly && !variants.includes(streetOnly)) {
        variants.push(streetOnly);
      }
    }

    // Try with district and city only (as last resort)
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

      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=vi`;

      const response = await fetch(nominatimUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Henzo Salon Booking App',
          Accept: 'application/json',
          'Accept-Language': 'vi-VN,vi,en-US,en',
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

        // Remove country name from the end of the address
        const cleanAddress = cleanAddressFromCountry(data.display_name);

        return {
          lat: parseFloat(data.lat),
          lon: parseFloat(data.lon),
          display_name: cleanAddress,
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
