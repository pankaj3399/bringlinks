import RedisClientMiddleware from "../../middleware/redis.middleware";
import Logging from "../../library/logging";

/**
 * CacheService handles all Redis caching operations
 * Provides methods for getting, setting, and invalidating cache
 */
class CacheService {
  private redisClient = RedisClientMiddleware._redisClient;

  /**
   * Generate a cache key based on resource type and identifier
   * @param resource - The resource type (e.g., 'user', 'post', 'room')
   * @param identifier - The unique identifier (e.g., userId, postId)
   * @param query - Optional query parameters object
   * @returns A formatted cache key
   */
  public generateCacheKey(
    resource: string,
    identifier: string | object,
    query?: any
  ): string {
    let key = `cache:${resource}:${identifier}`;
    if (query && Object.keys(query).length > 0) {
      const queryString = Object.keys(query)
        .sort()
        .map((k) => `${k}=${query[k]}`)
        .join("&");
      key += `:${queryString}`;
    }
    return key;
  }

  /**
   * Get data from cache
   * @param cacheKey - The cache key
   * @returns Parsed data from cache or null if not found
   */
  public async get(cacheKey: string): Promise<any | null> {
    try {
      const cachedData = await this.redisClient.get(cacheKey);
      if (cachedData) {
        Logging.info(`Cache HIT for key: ${cacheKey}`);
        return JSON.parse(cachedData);
      }
      Logging.info(`Cache MISS for key: ${cacheKey}`);
      return null;
    } catch (error) {
      Logging.error(`Error getting cache for key ${cacheKey}: ${error}`);
      return null;
    }
  }

  /**
   * Set data in cache with optional TTL
   * @param cacheKey - The cache key
   * @param data - The data to cache
   * @param ttl - Time to live in seconds (default: 3600 = 1 hour)
   */
  public async set(
    cacheKey: string,
    data: any,
    ttl: number = 3600
  ): Promise<void> {
    try {
      await this.redisClient.setEx(
        cacheKey,
        ttl,
        JSON.stringify(data)
      );
      Logging.info(`Cache SET for key: ${cacheKey} with TTL: ${ttl}s`);
    } catch (error) {
      Logging.error(`Error setting cache for key ${cacheKey}: ${error}`);
    }
  }

  /**
   * Delete a specific cache key
   * @param cacheKey - The cache key to delete
   */
  public async del(cacheKey: string): Promise<void> {
    try {
      await this.redisClient.del(cacheKey);
      Logging.info(`Cache DELETED for key: ${cacheKey}`);
    } catch (error) {
      Logging.error(`Error deleting cache for key ${cacheKey}: ${error}`);
    }
  }

  /**
   * Invalidate all cache keys matching a pattern
   * @param pattern - Pattern to match (e.g., 'cache:user:123*')
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        Logging.info(
          `Cache INVALIDATED ${keys.length} keys matching pattern: ${pattern}`
        );
      }
    } catch (error) {
      Logging.error(
        `Error invalidating cache with pattern ${pattern}: ${error}`
      );
    }
  }

  /**
   * Clear all cache entries for a specific resource
   * @param resource - The resource type to clear (e.g., 'user', 'post')
   */
  public async clearResourceCache(resource: string): Promise<void> {
    try {
      await this.invalidatePattern(`cache:${resource}:*`);
    } catch (error) {
      Logging.error(`Error clearing cache for resource ${resource}: ${error}`);
    }
  }

  /**
   * Clear all cache entries for a specific resource and identifier
   * @param resource - The resource type
   * @param identifier - The unique identifier
   */
  public async clearEntityCache(
    resource: string,
    identifier: string
  ): Promise<void> {
    try {
      await this.invalidatePattern(`cache:${resource}:${identifier}*`);
    } catch (error) {
      Logging.error(
        `Error clearing cache for ${resource}:${identifier}: ${error}`
      );
    }
  }
}

export default new CacheService();
