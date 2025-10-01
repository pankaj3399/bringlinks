import { cleanEnv, str, port, num } from "envalid";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate .env file
// Priority: explicit NODE_ENV file -> .env.development (if dev) -> .env
const nodeEnv = process.env.NODE_ENV;
let loadedPath = "";
if (nodeEnv) {
  const envFile = `.env.${nodeEnv}`;
  const result = dotenv.config({ path: envFile });
  if (!result.error) loadedPath = envFile;
}
if (!loadedPath) {
  // Fallback to .env if NODE_ENV not set or specific file missing
  const result = dotenv.config({ path: ".env" });
  if (!result.error) loadedPath = ".env";
}

// Validate environment variables
export const validateEnv = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "production"],
    default: "development",
  }),
  Mongo_User: str(),
  Mongo_Pass: str(),
  Mongo_Path: str(),
  Jwt_Secret_Key: str(),
  Jwt_Secret_Refresh_Key: str(),
  Jwt_Secret_Expiry: str(),
  Jwt_Secret_Refresh_Expiry: str(),
  AWS_ACCESS_KEY_ID: str(),
  AWS_ACCESS_KEY_SECRET: str(),
  AWS_AVI_BUCKET_NAME: str(),
  AWS_BUCKET_REGION: str(),
  AWS_BUCKET_ROOM_REGION: str(),
  AWS_AVI_BUCKET_NAME_ROOM_FLYER: str(),
  AWS_AVI_BUCKET_NAME_ROOM_MEDIA: str(),
  AWS_ACCESS_KEY_ID_ROOM_FLYER: str(),
  AWS_KEY_SECRET_ROOM_FLYER: str(),
  AWS_ACCESS_KEY_ID_ROOM_FLYER2: str(),
  AWS_KEY_SECRET_ROOM_FLYER2: str(),
  COOKIE: str(),
  PORT: port({ default: 3000 }),
  Saltrounds: num({ default: 11 }),
  BASE_URL: str(),
  CLOUDFRONT_AVI_BUCKET_URL: str(),
  CLOUDFRONT_KEY_PAIR_ID: str(),
  CLOUDFRONT_PRIVATE_KEY: str(),
  AWS_BUCKET_ARN: str(),
  FRONTEND_URL: str(),
  HELCIM_BASE_URL: str(),
  HELCIM_API_KEY: str(),
  // New auth/env vars
  ALLOWED_STATES: str({ default: "" }),
  TWILIO_ACCOUNT_SID: str({ default: "" }),
  TWILIO_AUTH_TOKEN: str({ default: "" }),
  TWILIO_PHONE_NUMBER: str({ default: "" }),
  // APPLE_CLIENT_ID: str({ default: "" }),
  // APPLE_TEAM_ID: str({ default: "" }),
  // APPLE_KEY_ID: str({ default: "" }),
  // APPLE_PRIVATE_KEY: str({ default: "" }),
  // Dev-only toggles
  // ALLOW_FAKE_APPLE_TOKEN: str({ default: "false" }),
  // APPLE_FAKE_JWT_SECRET: str({ default: "" }),
  // Google OAuth
  GOOGLE_CLIENT_ID: str({ default: "" }),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),
  GOOGLE_CALLBACK_URL: str({ default: "" }),
});
