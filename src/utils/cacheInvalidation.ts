import CacheService from "./cache/cache.service";
import Logging from "../library/logging";

/**
 * Cache invalidation utilities for controllers
 * Use these functions to invalidate cache when creating, updating, or deleting resources
 */
export class CacheInvalidation {
  /**
   * Invalidate cache for a specific resource
   * @param resource - Resource type (e.g., 'user', 'post', 'room')
   * @param identifier - Resource identifier (e.g., userId, postId)
   */
  static async invalidateEntity(resource: string, identifier: string) {
    try {
      await CacheService.clearEntityCache(resource, identifier);
      Logging.info(`Invalidated cache for ${resource}:${identifier}`);
    } catch (error) {
      Logging.error(`Failed to invalidate ${resource}:${identifier}: ${error}`);
    }
  }

  /**
   * Invalidate all cache for a specific resource type
   * @param resource - Resource type (e.g., 'user', 'post', 'room')
   */
  static async invalidateResource(resource: string) {
    try {
      await CacheService.clearResourceCache(resource);
      Logging.info(`Invalidated all cache for resource: ${resource}`);
    } catch (error) {
      Logging.error(`Failed to invalidate resource ${resource}: ${error}`);
    }
  }

  /**
   * Invalidate cache for related entities
   * Useful when one entity update affects multiple cached items
   * @param invalidations - Array of {resource, identifier} objects
   */
  static async invalidateMultiple(
    invalidations: Array<{ resource: string; identifier?: string }>
  ) {
    try {
      for (const { resource, identifier } of invalidations) {
        if (identifier) {
          await CacheService.clearEntityCache(resource, identifier);
        } else {
          await CacheService.clearResourceCache(resource);
        }
      }
      Logging.info(`Invalidated ${invalidations.length} cache entries`);
    } catch (error) {
      Logging.error(`Failed to invalidate multiple caches: ${error}`);
    }
  }

  /**
   * Invalidate cache with pattern matching
   * @param pattern - Pattern to match (e.g., 'cache:user:*')
   */
  static async invalidatePattern(pattern: string) {
    try {
      await CacheService.invalidatePattern(pattern);
      Logging.info(`Invalidated cache with pattern: ${pattern}`);
    } catch (error) {
      Logging.error(`Failed to invalidate pattern ${pattern}: ${error}`);
    }
  }
}

export default CacheInvalidation;
