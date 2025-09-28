import { cleanEnv, str, port, num } from "envalid";
import * as dotenv from "dotenv";

// Load environment variables from the specified .env file
const envFile = `.env.${process.env.NODE_ENV}`;
dotenv.config({ path: envFile });

// Debug: Log loaded environment variables to ensure they are loaded correctly
console.log("Loaded variables:", process.env.NODE_ENV);

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
});
