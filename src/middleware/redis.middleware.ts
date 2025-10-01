import { createClient, RedisClientType } from "redis";
import { validateEnv } from "../../config/validateEnv";

class RedisClientMiddleware {
  public _redisClient: RedisClientType;

  constructor() {
    const redisUrl = (validateEnv as any).REDIS_URL as string | undefined;
    const redisUrlTest = (validateEnv as any).REDIS_URL_TEST as string | undefined;

    if (validateEnv.NODE_ENV === "production") {
      // production instance
      this._redisClient = createClient({ url: redisUrl });
    } else {
      this._redisClient = createClient({ url: redisUrlTest });
    }
  }
}

export default new RedisClientMiddleware();
