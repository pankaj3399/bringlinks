import CacheService from "./cache/cache.service";
import RedisClientMiddleware from "../middleware/redis.middleware";
import Logging from "../library/logging";

/**
 * Cache testing and debugging utilities
 * Use these functions to verify caching is working correctly
 */
export class CacheTestUtils {
  /**
   * Get statistics about cached data
   * @returns Cache statistics
   */
  static async getCacheStats() {
    try {
      const redisClient = RedisClientMiddleware._redisClient;
      
      // Get all cache keys
      const keys = await redisClient.keys("cache:*");
      
      // Get info about each key
      const stats = {
        totalCacheEntries: keys.length,
        cacheKeys: keys,
        memoryUsage: await this.getMemoryUsage(),
        cacheEntryDetails: [] as any[]
      };

      // Get TTL for each key
      for (const key of keys.slice(0, 20)) { // Limit to first 20 for performance
        const ttl = await redisClient.ttl(key);
        const type = await redisClient.type(key);
        stats.cacheEntryDetails.push({
          key,
          ttl,
          type
        });
      }

      return stats;
    } catch (error) {
      Logging.error(`Error getting cache stats: ${error}`);
      throw error;
    }
  }

  /**
   * Get Redis memory usage
   */
  static async getMemoryUsage() {
    try {
      const redisClient = RedisClientMiddleware._redisClient;
      const info = await redisClient.info("memory");
      
      const lines = info.split("\r\n");
      const memoryData: any = {};
      
      lines.forEach((line) => {
        const [key, value] = line.split(":");
        if (key && value) {
          memoryData[key] = value;
        }
      });

      return {
        usedMemory: memoryData.used_memory,
        usedMemoryHuman: memoryData.used_memory_human,
        maxMemory: memoryData.maxmemory,
        memoryUsagePercent: memoryData.used_memory_rss
      };
    } catch (error) {
      Logging.error(`Error getting memory usage: ${error}`);
      return null;
    }
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  static async clearAllCache() {
    try {
      const redisClient = RedisClientMiddleware._redisClient;
      await redisClient.flushDb();
      Logging.info("All cache entries cleared");
    } catch (error) {
      Logging.error(`Error clearing cache: ${error}`);
      throw error;
    }
  }

  /**
   * Get specific cache entry
   */
  static async getCacheEntry(cacheKey: string) {
    try {
      const data = await CacheService.get(cacheKey);
      const redisClient = RedisClientMiddleware._redisClient;
      const ttl = await redisClient.ttl(cacheKey);

      return {
        key: cacheKey,
        data,
        ttlRemaining: ttl,
        exists: data !== null
      };
    } catch (error) {
      Logging.error(`Error getting cache entry: ${error}`);
      throw error;
    }
  }

  /**
   * Test cache performance
   * Stores test data and measures read time
   */
  static async testCachePerformance() {
    try {
      const testKey = "cache:test:performance";
      const testData = {
        message: "This is test data",
        timestamp: new Date(),
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `test-${i}` }))
      };

      // Measure write time
      const writeStart = Date.now();
      await CacheService.set(testKey, testData, 3600);
      const writeTime = Date.now() - writeStart;

      // Measure read time
      const readStart = Date.now();
      const retrievedData = await CacheService.get(testKey);
      const readTime = Date.now() - readStart;

      // Cleanup
      await CacheService.del(testKey);

      return {
        success: true,
        writeTimeMs: writeTime,
        readTimeMs: readTime,
        dataSize: JSON.stringify(testData).length,
        dataIntegrity: JSON.stringify(retrievedData) === JSON.stringify(testData)
      };
    } catch (error) {
      Logging.error(`Error in cache performance test: ${error}`);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Simulate cache hit/miss scenario
   */
  static async simulateCacheScenario(resource: string, identifier: string) {
    try {
      const cacheKey = CacheService.generateCacheKey(resource, identifier);
      const testData = {
        id: identifier,
        resource,
        createdAt: new Date(),
        data: "Sample cached data"
      };

      // Miss: Data not in cache
      let cachedData = await CacheService.get(cacheKey);
      const miss = cachedData === null;

      if (miss) {
        // Simulate database query delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        // Store in cache
        await CacheService.set(cacheKey, testData, 1800);
      }

      // Hit: Data should be in cache
      const readStart = Date.now();
      cachedData = await CacheService.get(cacheKey);
      const readTime = Date.now() - readStart;

      // Cleanup
      await CacheService.del(cacheKey);

      return {
        cacheKey,
        missOnFirstRead: miss,
        hitOnSecondRead: cachedData !== null,
        readTimeMs: readTime,
        dataMatches: JSON.stringify(cachedData) === JSON.stringify(testData)
      };
    } catch (error) {
      Logging.error(`Error simulating cache scenario: ${error}`);
      throw error;
    }
  }

  /**
   * Export cache statistics for monitoring
   */
  static async exportCacheStats() {
    try {
      const stats = await this.getCacheStats();
      const memory = await this.getMemoryUsage();
      const timestamp = new Date().toISOString();

      return {
        timestamp,
        totalCacheEntries: stats.totalCacheEntries,
        memoryUsage: memory,
        cacheHealth: {
          isHealthy: stats.totalCacheEntries < 10000, // Alert if too many entries
          recommendAction: stats.totalCacheEntries > 8000 ? "Consider clearing old entries" : "Normal"
        }
      };
    } catch (error) {
      Logging.error(`Error exporting cache stats: ${error}`);
      return null;
    }
  }

  /**
   * List all cache keys with their TTL
   */
  static async listAllCacheKeys(limit: number = 100) {
    try {
      const redisClient = RedisClientMiddleware._redisClient;
      const keys = await redisClient.keys("cache:*");
      
      const cacheKeysList = [];

      for (const key of keys.slice(0, limit)) {
        const ttl = await redisClient.ttl(key);
        const type = await redisClient.type(key);
        
        cacheKeysList.push({
          key,
          ttl,
          type,
          expiresIn: ttl === -1 ? "Never" : `${ttl}s`
        });
      }

      return {
        totalKeys: keys.length,
        displayedKeys: cacheKeysList.length,
        keys: cacheKeysList
      };
    } catch (error) {
      Logging.error(`Error listing cache keys: ${error}`);
      throw error;
    }
  }
}

export default CacheTestUtils;
