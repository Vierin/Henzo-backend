export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface ReverseGeocodingResult {
  address: string;
  city?: string;
  country?: string;
}

/**
 * Геокодирование адреса в координаты с использованием OpenStreetMap Nominatim API
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Henzo/1.0 (booking platform)',
        },
      },
    );

    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('No geocoding results found for:', address);
      return null;
    }

    const result = data[0];

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name || address,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Обратное геокодирование: координаты в адрес
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'Henzo/1.0 (booking platform)',
        },
      },
    );

    if (!response.ok) {
      console.error('Reverse geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.error) {
      console.log('No reverse geocoding results found');
      return null;
    }

    return {
      address: data.display_name || '',
      city: data.address?.city || data.address?.town || data.address?.village,
      country: data.address?.country,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Батч геокодирование нескольких адресов с учетом rate limiting
 */
export async function batchGeocodeAddresses(
  addresses: string[],
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();

  // Обрабатываем адреса батчами по 5 штук с задержкой
  const batchSize = 5;
  const delay = 1000; // 1 секунда между батчами для соблюдения rate limit Nominatim

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);

    const batchPromises = batch.map(async (address) => {
      const result = await geocodeAddress(address);
      if (result) {
        results.set(address, result);
      }
    });

    await Promise.all(batchPromises);

    // Задержка между батчами
    if (i + batchSize < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}
