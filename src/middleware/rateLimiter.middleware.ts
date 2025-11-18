import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import RedisClientMiddleware from "./redis.middleware";
import jwt from "jsonwebtoken";
import { validateEnv } from "../../config/validateEnv";

// Token-based rate limiter - 10 requests per second per user
const createRateLimiter = () => {
  return rateLimit({
    windowMs: 1000, // 1 second window
    max: 10, // Limit each user to 10 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Use user's token (userId) as the key for rate limiting
    keyGenerator: (req: Request): string => {
      try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>
        
        if (token) {
          // Decode the JWT token to get user ID
          const decoded = jwt.verify(token, validateEnv.Jwt_Secret_Key) as jwt.JwtPayload;
          const userId = decoded?._id || decoded?.userId;
          
          if (userId) {
            return `user:${userId}`;
          }
        }
      } catch (error) {
        // If token is invalid or not present, fall through to IP-based limiting
      }
      
      // Fallback to IP address if no valid token
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `ip:${ip}`;
    },

    // Custom handler for when rate limit is exceeded
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: "Too Many Requests",
        message: "You have exceeded the rate limit of 10 requests per second. Please try again later.",
        retryAfter: 1, // seconds
      });
    },

    // Skip failed requests (don't count them against the limit)
    skipFailedRequests: false,
    
    // Skip successful requests (count all requests)
    skipSuccessfulRequests: false,

    // Use Redis store for distributed rate limiting
    store: new RedisStore({
      // @ts-expect-error - RedisStore expects a different client type but works with redis v5
      client: RedisClientMiddleware._redisClient,
      prefix: "ratelimit:",
      sendCommand: async (...args: string[]) => {
        return await RedisClientMiddleware._redisClient.sendCommand(args);
      },
    }),
  });
};

export default createRateLimiter;
