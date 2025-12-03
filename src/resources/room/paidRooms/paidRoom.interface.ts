import mongoose, { Document } from "mongoose";

export interface IPaidRooms extends Document {
  tickets: Tickets;
}

export type Tickets = {
  totalRevenue: number;
  totalTicketsAvailable: number;
  totalSold: number;
  ticketsTotal: number;
  pricing: PricingTiers[];
  roomId: mongoose.Types.ObjectId;
  receiptId?: string[];
  paidUsers?: mongoose.Types.ObjectId[];
  refreshToken?: string;
  paid?: boolean;
};

export type PricingTiers = {
  tiers: Tiers;
  description: string;
  title: string;
  total: number;
  price: number;
  sold: number;
  available: number;
  active: boolean;
};

export enum Tiers {
  GA = "General Admission",
  Early_Bird = "Early Bird",
  Last_Minute = "Last Minute",
  Vip = "Vip",
  Premium_Vip = "Premium Vip",
  Ultimate_Vip = "Ultimate Vip",
}
