import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.reset();
  }

  // Batch operations (sequential for in-memory cache)
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    const results = await Promise.all(keys.map((key) => this.get<T>(key)));
    return results.map((r) => r ?? null);
  }

  async setMany(
    entries: Array<{ key: string; value: any; ttl?: number }>,
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, ttl }) => this.set(key, value, ttl)),
    );
  }

  // Note: Pattern invalidation not supported in in-memory cache
  // For MVP this is acceptable - cache will expire naturally
  async invalidatePattern(pattern: string): Promise<void> {
    // In-memory cache doesn't support pattern matching
    // Cache will expire based on TTL
    console.warn(
      `Pattern invalidation not supported in in-memory cache: ${pattern}`,
    );
  }
}

