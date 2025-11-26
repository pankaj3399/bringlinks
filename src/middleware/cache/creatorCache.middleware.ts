import CacheService from "../../utils/cache/cache.service";
import { NextFunction, Request, Response } from "express";
import Logging from "../../library/logging";

interface CreatorCacheOptions {
  ttl?: number; // Time to live in seconds
  enabled?: boolean; // Whether caching is enabled
}

export const creatorCacheMiddleware = (options: CreatorCacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      return next();
    }

    const { ttl = 3600, enabled = true } = options;

    if (!enabled) {
      return next();
    }

    try {
      const cacheKey = buildCacheKey(req);
      
      if (!cacheKey) return next();

      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        Logging.info(`Creator cache hit: ${cacheKey}`);
        return res.json(cachedData);
      }

      Logging.info(`Creator cache miss: ${cacheKey}`);

      const originalJson = res.json.bind(res);

      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(cacheKey, data, ttl).catch((error: any) => {
            Logging.error(`Failed to cache creator response: ${error}`);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      Logging.error(`Creator cache middleware error: ${error}`);
      next();
    }
  };
};

export const invalidateCreatorCache = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { userId } = req.params;
      
      if (req.path.includes("/stripe-connect/onboard")) {
        const userid = req.user?._id;
        if (!userid) return next();
        userId = userid;
      }
      
      if (req.path.includes("/stripe-connect/complete/")) {
        await CacheService.clearEntityCache("creator:stripe-connect-status", userId);
        Logging.info(`Invalidated cache for Creator creator:stripe-connect-status:${userId}`);
      }
      
      await CacheService.clearEntityCache("creator:profile", userId);
      Logging.info(`Invalidated cache for Creator creator:profile:${userId}`);
      next();
    } catch (error) {
      Logging.error(`Creator cache invalidation error: ${error}`);
      next();
    }
  }
}

const buildCacheKey = (req: Request) => {
  const path = req.path;
  const { userId, creatorId } = req.params;
  
  if (path.includes("/profile/creator-reviews/")) {
    if (!creatorId) return;
    return `cache:creator:reveiws:${creatorId}`;
  }
  
  if (path.includes("/profile/")) {
    if (!userId) return;
    return `cache:creator:profile:${userId}`;
  }
  
  if (path.includes("/can-create-paid-rooms/")) {
    if (!userId) return;
    return `cache:creator:can-create-paid-rooms:${userId}`;
  }
  
  if (path.includes("/earnings/")) {
    if (!userId) return;
    return `cache:creator:earnings:${userId}`;
  }
  
  if (path.includes("/stripe-connect/status/")) {
    if (!userId) return;
    return `cache:creator:stripe-connect-status:${userId}`;
  }
}
