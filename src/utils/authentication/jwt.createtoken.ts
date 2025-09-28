import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import Logging from "../../library/logging";
import { validateEnv } from "../../../config/validateEnv";
dotenv.config();

const CreateToken = (payload: JwtPayload) => {
  const secretKey = validateEnv.Jwt_Secret_Key
    ? validateEnv.Jwt_Secret_Key
    : null;
  if (!secretKey) {
    throw Error("no secret key found");
  }
  const refreshSecretKey = validateEnv.Jwt_Secret_Refresh_Key;
  if (!refreshSecretKey) {
    throw Error("no refresh secret key found");
  }

  const token = jwt.sign(JSON.stringify(payload), secretKey);

  const refreshToken = jwt.sign({ payload }, refreshSecretKey);

  return [token, refreshToken];
};

// Verify Access Token
export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, validateEnv.Jwt_Secret_Key);
};

// Verify Refresh Token
export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, validateEnv.Jwt_Secret_Refresh_Key);
};

export default { CreateToken };
