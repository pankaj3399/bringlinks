import { model, Schema } from "mongoose";
import { IReceipts, PaymentStatus } from "./receipts.interface";

const ReceiptsSchema = new Schema<IReceipts>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paidRoomId: {
      type: Schema.Types.ObjectId,
      ref: "PaidRooms",
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
    },
    status: {
      type: String,
      enum: PaymentStatus,
    },
  },
  { timestamps: true }
);

ReceiptsSchema.index({ userId: 1, paidRoomId: 1 });
ReceiptsSchema.index({ userId: 1, roomId: 1 });
ReceiptsSchema.index({ paidRoomId: 1 });
ReceiptsSchema.index({ userId: 1 });
ReceiptsSchema.index({ roomId: 1 });
ReceiptsSchema.index({ ticketId: 1 });
ReceiptsSchema.index({ status: 1 });

const Receipts = model<IReceipts>("Receipts", ReceiptsSchema);
export default Receipts;
