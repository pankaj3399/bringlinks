import CacheService from "../../utils/cache/cache.service";
import { Request, Response, NextFunction } from "express";
import Logging from "../../library/logging";

interface PostCacheOptions {
  ttl?: number;
  enabled?: boolean;
}

export const postCacheMiddleware = (options: PostCacheOptions = {}) => {
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
        Logging.info(`Post cache hit: ${cacheKey}`);
        return res.json(cachedData);
      }
      
      Logging.info(`Post cache miss: ${cacheKey}`);
      
      const originalJson = res.json.bind(res);
      
      res.json = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(cacheKey, data, ttl).catch((error: any) => {
            Logging.error(`Failed to cache post response: ${error}`);
          })
        }
        return originalJson(data);
      }
      
      next();
    } catch (error) {
      Logging.error(`Post cache middleware error: ${error}`);
      next();
    }
  } 
}

export const invalidatePostCache = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    try {
      const { postid, userid } = req.params;
      
      if (path.includes("/deletepost/")) {
        await CacheService.clearEntityCache("post:share-links", postid);
        Logging.info(`Invalidated cache for post:share-links ${postid}`);
        Logging.info(`Invalidated cache for post:user-posts ${userid}`);
      }
      
      CacheService.clearEntityCache("post", postid);
      CacheService.clearEntityCache("post:user-posts", userid);
      Logging.info(`Invalidated cache for post ${postid}`);
      Logging.info(`Invalidated cache for post:user-posts ${userid}`);
      next();
    } catch (error) {
      Logging.error(`User cache invalidation error: ${error}`);
      next();
    }
  }
}

const buildCacheKey = (req: Request): string | undefined => {
  const path = req.path;
  const { postid, userid } = req.params;
  
  if (path.includes("/share-links")) {
    if (!postid) return undefined;
    return `cache:post:share-links:${postid}`;
  }
  
  if (path.includes("/user/all")) {
    if (!userid) return undefined;
    return `cache:post:user-posts:${userid}`
  }
  
  // for /:userid/:postid
  return `cache:post:${postid}`;
}
