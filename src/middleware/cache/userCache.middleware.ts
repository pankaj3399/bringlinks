import { Request, Response, NextFunction } from "express";
import CacheService from "../../utils/cache/cache.service";
import Logging from "../../library/logging";
import { getUserById } from "../../resources/user/user.service";

/**
 * User-specific cache configuration options
 */
interface UserCacheOptions {
  ttl?: number; // Time to live in seconds
  enabled?: boolean; // Whether caching is enabled
}

/**
 * Cache middleware specifically for user endpoints
 * Handles caching patterns for:
 * - User by ID
 * - User by username
 * - User schedule
 * - User image
 * - Recommended rooms
 */
export const userCacheMiddleware = (options: UserCacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      return next();
    }

    const { ttl = 3600, enabled = true } = options;

    if (!enabled) {
      return next();
    }

    try {
      const cacheKey = buildUserCacheKey(req);
      
      if (!cacheKey) return next();

      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        Logging.info(`User cache hit: ${cacheKey}`);
        return res.json(cachedData);
      }

      Logging.info(`User cache miss: ${cacheKey}`);

      const originalJson = res.json.bind(res);

      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(cacheKey, data, ttl).catch((error: any) => {
            Logging.error(`Failed to cache user response: ${error}`);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      Logging.error(`User cache middleware error: ${error}`);
      next();
    }
  };
};

/**
 * Invalidate user cache for specific operations
 * Clears ALL user-related cache entries when user data is modified.
 */
export const invalidateUserCache = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, username, followerId } = req.params;

      const userIdsToInvalidate = new Set<string>();

      if (userId) {
        userIdsToInvalidate.add(userId);
      }

      if (followerId) {
        userIdsToInvalidate.add(followerId);
      }

      for (const id of userIdsToInvalidate) {
        if (req.path.includes("/image/") || req.path.includes("/deactivate/")) {
          await CacheService.clearEntityCache("user:image", userId);
        }
        
        if (!req.path.includes("/follow/") || !req.path.includes("/unfollow/")) {
          await CacheService.clearEntityCache("user:recommendedRooms", id);
          
          if (!req.path.includes("/userpreferences/") || req.path.includes("/update/")  || req.path.includes("/deactivate/")) {
            await CacheService.clearEntityCache("user:schedule", id);
          }
        }
        
        await CacheService.clearEntityCache("user", id);
        Logging.info(
          `Invalidated all user caches for ID: ${id}`
        );
      }

      let usernameToInvalidate: string | undefined = username;

      if (!usernameToInvalidate && userId) {
        const user = await getUserById(userId);
        usernameToInvalidate = user?.auth.username;
      }

      if (usernameToInvalidate) {
        const usernameCacheKey = `cache:user:username:${usernameToInvalidate}`;
        await CacheService.clearEntityCache("user", usernameCacheKey);
      }

      next();
    } catch (error) {
      Logging.error(`User cache invalidation error: ${error}`);
      next();
    }
  };
};

/**
 * Helper function to build cache keys based on route patterns
 */
function buildUserCacheKey(req: Request): string | undefined {
  const { userId, username } = req.params;

  if (req.path.includes("/image/") && userId) {
    return `cache:user:image:${userId}`;
  }

  if (req.path.includes("/schedule/") && userId) {
    return `cache:user:schedule:${userId}`;
  }

  if (req.path.includes("/recommendedRooms/") && userId) {
    return `cache:user:recommendedRooms:${userId}`;
  }

  if (req.path.includes("/username/") && username) {
    return `cache:user:username:${username}`;
  }

  if (userId) {
    return `cache:user:${userId}`;
  }
}

export default userCacheMiddleware;
