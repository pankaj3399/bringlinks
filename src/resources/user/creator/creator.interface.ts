import mongoose, { Document, Model } from "mongoose";
import { IRoles } from "../user.interface";

export enum StripeAccountStatus {
  PENDING = "pending",
  ACTIVE = "active",
  RESTRICTED = "restricted",
}

export interface ICreator extends Document {
  userId: mongoose.Types.ObjectId;
  signupCode: string;  
  portfolio?: string;
  socialMedia?: string[];
  experience?: string;
  stripeConnectAccountId?: string;
  stripeAccountStatus?: StripeAccountStatus;
  stripeAccountLink?: string; 
  reviews: IReviews[];
  createdRooms: mongoose.Types.ObjectId[];
  userScore: Score;
  totalReviews: number;
  totalRoomsCreated: number;
  activeRooms: number;
  totalEarnings: number;
  totalPayouts: number;
  pendingBalance: number;
}

export interface ICreatorRegistrationRequest {
  userId: string;
  signupCode: string; 
  portfolio?: string;
  socialMedia?: string[];
  experience?: string;
}

export interface ICreatorSignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  state: string;
  signupCode: string; 
  portfolio?: string;
  socialMedia?: string[];
  experience?: string;
}

export interface IStripeConnectOnboardingResponse {
  accountId: string;
  accountLink: string;
  status: StripeAccountStatus;
}

export interface ICreatorEligibilityResponse {
  canCreate: boolean;
  reason?: string;
  redirectTo?: string;
  action?: string;
}

export interface IReviews {
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Score {
  average: number;
  count: number;
}

export interface ICreatorDocument extends ICreator, Document {}

export interface ICreatorModel extends Model<ICreatorDocument> {
  findCreatorById(_id: string): Promise<ICreatorDocument | null>;
}

export default ICreator;