import { Request, Response, NextFunction } from "express";
import CacheService from "../utils/cache/cache.service";
import Logging from "../library/logging";

/**
 * Cache configuration options
 */
interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 3600)
  enabled?: boolean; // Whether caching is enabled (default: true)
  excludeParams?: string[]; // Query parameters to exclude from cache key
}

/**
 * Cache middleware that intercepts GET requests
 * Checks Redis cache before executing route handler
 * If cache miss, executes handler and stores result in Redis
 *
 * Usage in controller:
 * this.router.get(`${this.path}/:userId`, cacheMiddleware({ ttl: 1800 }), RequiredAuth, this.getUser);
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const { ttl = 3600, enabled = true, excludeParams = [] } = options;

    if (!enabled) {
      return next();
    }

    try {
      // Build cache key from path and query parameters
      const cleanQuery = { ...req.query };
      excludeParams.forEach((param) => {
        delete cleanQuery[param];
      });

      const cacheKey = CacheService.generateCacheKey(
        req.path,
        JSON.stringify(cleanQuery)
      );

      // Check Redis cache
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Store original res.json to intercept the response
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (data: any) {
        // Only cache successful responses (2xx status)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(cacheKey, data, ttl).catch((error: any) => {
            Logging.error(`Failed to cache response: ${error}`);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      Logging.error(`Cache middleware error: ${error}`);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Middleware to invalidate specific cache entry
 * Use on POST, PUT, PATCH, DELETE routes to clear related cache
 *
 * Usage:
 * this.router.put(`${this.path}/:userId`, invalidateCache('user'), RequiredAuth, this.updateUser);
 */
export const invalidateCache = (resource: string, identifier?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (identifier) {
        // Invalidate specific entity cache
        const id = req.params[identifier];
        if (id) {
          await CacheService.clearEntityCache(resource, id);
        }
      } else {
        // Invalidate all cache for this resource
        await CacheService.clearResourceCache(resource);
      }

      next();
    } catch (error) {
      Logging.error(`Cache invalidation error: ${error}`);
      next(); // Continue even if invalidation fails
    }
  };
};

/**
 * Advanced cache middleware for specific route patterns
 * Allows fine-grained control over cache keys and TTL
 *
 * Usage:
 * this.router.get(`${this.path}/:userId`, advancedCacheMiddleware({
 *   keyBuilder: (req) => `user:${req.params.userId}`,
 *   ttl: 1800,
 *   excludeParams: ['timestamp']
 * }), this.getUser);
 */
export const advancedCacheMiddleware = (options: {
  keyBuilder: (req: Request) => string;
  ttl?: number;
  enabled?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || options.enabled === false) {
      return next();
    }

    try {
      const cacheKey = options.keyBuilder(req);
      const ttl = options.ttl || 3600;

      // Check cache
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache response
      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(cacheKey, data, ttl).catch((error: any) => {
            Logging.error(`Failed to cache response: ${error}`);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      Logging.error(`Advanced cache middleware error: ${error}`);
      next();
    }
  };
};

export default cacheMiddleware;
