import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../utils/authentication/jwt.createtoken";
import Logging from "../library/logging";
import { IRoles } from "resources/user/user.interface";

// Middleware to authenticate token
export const RequiredAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: "Token missing or invalid" });
  }

  try {
    const decoded = verifyAccessToken(token) as jwt.JwtPayload;
    const userId = decoded?._id || decoded?.userId;
    req.user = { _id: userId, role: decoded?.role } as any;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token invalid or expired" });
  }
};

// Middleware to check role
export const AuthorizeRole = (role: IRoles) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not have the required role" });
    }
    next();
  };
};

// Middleware RequiredRoomEntry to check token and roomId
export const RequiredPaidRoomEntry = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.split(" ")[1];

    const user = req.user;

    if (!token) {
      return res.status(401).json({ message: "Token missing or invalid" });
    }

    const raw = verifyAccessToken(token) as unknown;
    const decoded: any = typeof raw === "string" ? JSON.parse(raw) : (raw as jwt.JwtPayload);
    req.paidRoom = {
      roomId: decoded?.roomId,
      userId: decoded?.userId || decoded?._id,
      role: decoded?.role,
    } as any;

    if (!decoded || String(user?._id) !== String(decoded?.userId || decoded?._id))
      return res.status(403).json({ message: "Token invalid or expired" });

    next();
  } catch (error: any) {
    throw error.message;
  }
};

// RequiredAuth for Wallet Access
export const RequiredWalletAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ message: "Token missing or invalid" });
    }

    const raw = verifyAccessToken(token) as unknown;
    const decoded: any = typeof raw === "string" ? JSON.parse(raw) : (raw as jwt.JwtPayload);
    req.wallet = {
      userId: decoded?.userId || decoded?._id,
      walletId: decoded?._id,
      name: decoded?.name,
      email: decoded?.email,
    } as any;

    if (!decoded)
      return res.status(403).json({ message: "Token invalid or expired" });

    next();
  } catch (error: any) {
    throw error.message;
  }
};
