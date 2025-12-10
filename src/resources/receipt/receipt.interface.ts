import mongoose, { Document } from "mongoose";

export enum PaymentStatus {
  COMPLETED = "completed",
  REFUNDED = "refunded",
  PENDING = "pending",
  FAILED = "failed",
}

export interface TaxBreakdownItem {
  rate: number;
  amount: number;
  jurisdiction: string;
  taxabilityReason?: string;
}

export interface IUserReceipt extends Document {
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  stripePaymentIntentId: string;
  stripeSessionId: string;
  tierTitle: string;
  tierType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  totalWithTax?: number;
  taxBreakdown?: TaxBreakdownItem[];
  entryQRCode: string;
  ticketId: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}
