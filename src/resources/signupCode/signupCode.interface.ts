import { Document, Model } from "mongoose";

export interface ISignupCode {
  code: string;
  maxUsages: number;
  currentUsages: number;
  isActive: boolean;
  createdBy: string; // Admin user ID
  expiresAt?: Date;
  isUsed?: boolean; 
  usedBy?: string; 
  usedAt?: Date; 
  createdAt: Date;
  updatedAt: Date;
}

export interface ISignupCodeDocument extends ISignupCode, Document {}

export interface ISignupCodeModel extends Model<ISignupCodeDocument> {
  findActiveCode(code: string): Promise<ISignupCodeDocument | null>;
  incrementUsage(code: string): Promise<ISignupCodeDocument | null>;
}




