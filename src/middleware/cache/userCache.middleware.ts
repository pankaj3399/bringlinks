import { Request, Response, NextFunction } from "express";
import CacheService from "../../utils/cache/cache.service";
import Logging from "../../library/logging";
import { getUserById } from "../../resources/user/user.service";
interface UserCacheOptions {
  ttl?: number; // Time to live in seconds
  enabled?: boolean; // Whether caching is enabled
}

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
      
      if (!cacheKey) {
        Logging.warning(`Failed to generate User cache key for request: ${req.originalUrl}`);
        return next();
      }

      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        Logging.info(`User cache hit: ${cacheKey}`);
        return res.json(cachedData);
      }

      Logging.info(`User cache miss: ${cacheKey}`);

      const originalJson = res.json.bind(res);

      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = sanitizeUserForCache(data);
          CacheService.set(cacheKey, cacheData, ttl).catch((error: any) => {
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

export const invalidateUserCache = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { userId, username, followerId } = req.params;

      if (req.path.includes("/updatepassword/")) {
        if (!req.user?._id) {
          Logging.warning(`Failed to invalidate User caching while updating password, user id was not provided.`);
          return next();
        }
        userId = req.user._id.toString();
      }

      const userIdsToInvalidate = new Set<string>();

      if (userId) {
        userIdsToInvalidate.add(userId);
      }

      if (followerId) {
        userIdsToInvalidate.add(followerId);
      }

      for (const id of userIdsToInvalidate) {
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
        await CacheService.del(usernameCacheKey);
      }

      next();
    } catch (error) {
      Logging.error(`User cache invalidation error: ${error}`);
      next();
    }
  };
};

function buildUserCacheKey(req: Request): string | undefined {
  const { userId, username } = req.params;

  if (req.path.includes("/username/")) {
    if (!username) return;
    return `cache:user:username:${username}`;
  }

  if (userId) {
    return `cache:user:${userId}`;
  }
}

function sanitizeUserForCache(data: any) {
  if (data && typeof data === 'object') {
    const sanitized = { ...data };
    delete sanitized.refreshToken;
    delete sanitized.signupCode;
    delete sanitized.googleId;
    return sanitized;
  }
  return data;
}

export default userCacheMiddleware;
