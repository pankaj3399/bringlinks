import { createClient, RedisClientType } from "redis";

class RedisClientMiddleware {
  public _redisClient: RedisClientType;

  constructor() {
    if (process.env.NODE_ENV === "production") {
      // production instance
      this._redisClient = createClient({
        url: process.env.REDIS_URL,
      });
    } else {
      this._redisClient = createClient({
        // localhost
        url: process.env.REDIS_URL_TEST,
      });
    }
  }
}

export default new RedisClientMiddleware();
