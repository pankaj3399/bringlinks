import { model, Schema } from "mongoose";
import { IUserReceipt, PaymentStatus } from "./receipt.interface";

const UserReceiptSchema = new Schema<IUserReceipt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Rooms",
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
    },
    stripeSessionId: {
      type: String,
      required: true,
    },
    tierTitle: {
      type: String,
      required: true,
    },
    tierType: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    entryQRCode: {
      type: String,
      required: true,
    },
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: PaymentStatus,
      default: PaymentStatus.COMPLETED,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for common queries
UserReceiptSchema.index({ userId: 1 });
UserReceiptSchema.index({ roomId: 1 });
UserReceiptSchema.index({ stripePaymentIntentId: 1 });
UserReceiptSchema.index({ ticketId: 1 });
UserReceiptSchema.index({ userId: 1, roomId: 1 });

const UserReceipt = model<IUserReceipt>("UserReceipt", UserReceiptSchema);
export default UserReceipt;

