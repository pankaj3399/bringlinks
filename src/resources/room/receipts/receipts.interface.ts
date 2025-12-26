import mongoose, { Model } from "mongoose";

export interface IReceipts extends Document {
  userId: mongoose.Types.ObjectId;
  paidRoomId: mongoose.Types.ObjectId;
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

export enum PaymentStatus {
  COMPLETED = "completed",
  REFUNDED = "refunded",
  PENDING = "pending",
  FAILED = "failed",
}

export interface IReceiptsModel extends Model<IReceipts> {
  createReceipt: (receipt: IReceipts) => Promise<IReceipts>;
  getReceipts: (userId: mongoose.Types.ObjectId) => Promise<IReceipts[]>;
  getReceipt: (receiptId: mongoose.Types.ObjectId) => Promise<IReceipts>;
  updateReceipt: (
    receiptId: mongoose.Types.ObjectId,
    receipt: IReceipts
  ) => Promise<IReceipts>;
  deleteReceipt: (receiptId: mongoose.Types.ObjectId) => Promise<void>;
}

export interface IReceiptsDocument extends IReceipts, Document {}
