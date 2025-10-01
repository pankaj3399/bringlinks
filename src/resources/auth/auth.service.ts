import * as dotenv from "dotenv";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";
import OtpVerification from "./otp.model";
import User from "../user/user.model";
import jwtToken from "../../utils/authentication/jwt.createtoken";
import axios from "axios";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

dotenv.config();

const parseAllowedStates = (): string[] => {
  const raw = validateEnv.ALLOWED_STATES || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => !!s);
};

const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendSms = async (to: string, message: string) => {
  const sid = validateEnv.TWILIO_ACCOUNT_SID as string;
  const token = validateEnv.TWILIO_AUTH_TOKEN as string;
  const from = validateEnv.TWILIO_PHONE_NUMBER as string;

  if (!sid || !token || !from) {
    const missing: string[] = [];
    if (!sid) missing.push("TWILIO_ACCOUNT_SID");
    if (!token) missing.push("TWILIO_AUTH_TOKEN");
    if (!from) missing.push("TWILIO_PHONE_NUMBER");
    throw new Error(
      `Twilio not configured. Missing: ${missing.join(", ")}. Ensure E.164 numbers: to=${to}, from=${from || "<unset>"}`
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams();
  form.append("To", to);
  form.append("From", from);
  form.append("Body", message);

  try {
    await axios.post(url, form.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: sid, password: token },
    });
  } catch (err: any) {
    const twilioStatus = err?.response?.status;
    const twilioData = err?.response?.data;
    Logging.error({ twilioStatus, twilioData, hint: "Twilio SMS send failed" });
    const reason = twilioData?.message || twilioData?.error_message || err.message;
    const code = twilioData?.code || twilioData?.error_code;
    throw new Error(`Twilio SMS failed${code ? ` [${code}]` : ""}: ${reason}`);
  }
};

const verifyAppleToken = async (idToken: string) => {
  // Dev shortcut: allow locally signed fake token when enabled
  if ((validateEnv.ALLOW_FAKE_APPLE_TOKEN || "false").toLowerCase() === "true") {
    const secret = validateEnv.APPLE_FAKE_JWT_SECRET || "dev-fake-secret";
    try {
      const payload: any = jwt.verify(idToken, secret, { algorithms: ["HS256"] });
      const appleUserId = payload.sub || payload.appleUserId || "fake-apple-user";
      const email = payload.email;
      return { appleUserId, email, payload };
    } catch (e) {
      throw new Error("Invalid fake Apple token");
    }
  }
  // Use Apple's JWKS to verify token

  const client = jwksRsa({
    jwksUri: "https://appleid.apple.com/auth/keys",
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
  });

  const decoded: any = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Invalid Apple token");
  }
  const kid = decoded.header.kid as string;
  const key = await client.getSigningKey(kid);
  const signingKey = key.getPublicKey();

  const payload: any = jwt.verify(idToken, signingKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
  });

  const appleUserId = payload.sub as string;
  const email = payload.email as string | undefined;
  return { appleUserId, email, payload };
};

class AuthService {
  static async sendOtp(phoneNumber: string, state: string) {
    const allowed = parseAllowedStates();
    if (!allowed.includes(state.trim().toLowerCase())) {
      return { success: false, message: "Service not available in your state." };
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await OtpVerification.findOneAndUpdate(
      { phoneNumber },
      { phoneNumber, state, otp, otpExpiry: expiry },
      { upsert: true, new: true }
    );

    await sendSms(phoneNumber, `Your verification code is ${otp}`);
    return { success: true, message: "OTP sent successfully." };
  }

  static async verifyOtp(phoneNumber: string, otp: string) {
    const record = await OtpVerification.findOne({ phoneNumber }).exec();
    if (!record || record.otp !== otp) {
      return { success: false, message: "Invalid OTP." };
    }
    if (record.otpExpiry && record.otpExpiry.getTime() < Date.now()) {
      return { success: false, message: "OTP expired." };
    }

    // Mark user as verified if user exists for this phoneNumber; do not auto-create
    await User.findOneAndUpdate(
      { phoneNumber },
      { $set: { isVerified: true, state: record.state } }
    ).exec();

    await OtpVerification.deleteOne({ phoneNumber }).exec();
    return { success: true, message: "OTP verified." };
  }

  // static async appleSignin(appleToken: string) {
  //   const { appleUserId, email } = await verifyAppleToken(appleToken);
  //   const user = await User.findOne({ $or: [{ appleId: appleUserId }, { "auth.email": email }] }).exec();
  //   if (!user) {
  //     throw new Error("User not found. Complete phone verification and account setup first.");
  //   }
  //   if (!(user as any).isVerified) {
  //     throw new Error("Phone not verified");
  //   }
  //   user.set({ appleId: appleUserId });
  //   await user.save();
  //   const [accessToken, refreshToken] = jwtToken.CreateToken({
  //     _id: (user as any)._id,
  //     username: (user as any).auth?.username,
  //     email: (user as any).auth?.email,
  //   } as any);
  //   return { success: true, accessToken, refreshToken, user };
  // }
}

export default AuthService;


