import mongoose, { Document } from "mongoose";

export enum PaymentStatus {
  COMPLETED = "completed",
  REFUNDED = "refunded",
  PENDING = "pending",
  FAILED = "failed",
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
  entryQRCode: string;
  ticketId: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

