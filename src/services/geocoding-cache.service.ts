import { Injectable, Logger } from '@nestjs/common';
import { geocodeAddress } from '../utils/geocoding';

export interface CachedCoordinates {
  latitude: number;
  longitude: number;
  timestamp: number;
}

@Injectable()
export class GeocodingCacheService {
  private readonly logger = new Logger(GeocodingCacheService.name);
  private cache = new Map<string, CachedCoordinates>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа
  private readonly MAX_CACHE_SIZE = 1000; // Максимум 1000 адресов в кэше

  /**
   * Получить координаты для адреса (из кэша или геокодирование)
   */
  async getCoordinates(
    address: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!address || address.trim() === '') {
      return null;
    }

    const normalizedAddress = this.normalizeAddress(address);

    // Проверяем кэш
    const cached = this.cache.get(normalizedAddress);
    if (cached && this.isCacheValid(cached)) {
      this.logger.debug(`Cache hit for address: ${normalizedAddress}`);
      return { latitude: cached.latitude, longitude: cached.longitude };
    }

    // Геокодируем
    this.logger.debug(`Geocoding address: ${normalizedAddress}`);
    try {
      const result = await geocodeAddress(normalizedAddress);

      if (result) {
        // Сохраняем в кэш
        this.setCache(normalizedAddress, {
          latitude: result.latitude,
          longitude: result.longitude,
          timestamp: Date.now(),
        });

        this.logger.debug(
          `Geocoded and cached: ${normalizedAddress} -> ${result.latitude}, ${result.longitude}`,
        );
        return { latitude: result.latitude, longitude: result.longitude };
      } else {
        this.logger.warn(`Failed to geocode address: ${normalizedAddress}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error geocoding address ${normalizedAddress}:`, error);
      return null;
    }
  }

  /**
   * Получить координаты для нескольких адресов
   */
  async getCoordinatesBatch(
    addresses: string[],
  ): Promise<Map<string, { latitude: number; longitude: number }>> {
    const results = new Map<string, { latitude: number; longitude: number }>();

    // Обрабатываем адреса батчами по 5 штук с задержкой
    const batchSize = 5;
    const delay = 1000; // 1 секунда между батчами

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      const batchPromises = batch.map(async (address) => {
        const coords = await this.getCoordinates(address);
        if (coords) {
          results.set(address, coords);
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

  /**
   * Очистить кэш
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Geocoding cache cleared');
  }

  /**
   * Получить статистику кэша
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: добавить подсчет hit rate
    };
  }

  /**
   * Нормализовать адрес для кэширования
   */
  private normalizeAddress(address: string): string {
    return address.trim().toLowerCase();
  }

  /**
   * Проверить, валиден ли кэш
   */
  private isCacheValid(cached: CachedCoordinates): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL;
  }

  /**
   * Сохранить в кэш с проверкой размера
   */
  private setCache(address: string, coordinates: CachedCoordinates): void {
    // Если кэш переполнен, удаляем самые старые записи
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(address, coordinates);
  }
}
