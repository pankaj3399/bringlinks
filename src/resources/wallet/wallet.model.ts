import mongoose, { model, Schema } from "mongoose";
import { IWalletDocument, IWalletModel } from "./wallet.interface";

const walletSchema = new Schema<IWalletModel & IWalletDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    cardInfo: {
      token: {
        type: String,
        required: true,
      },
      last4: {
        type: String,
        required: true,
      },
      accountHolder: {
        type: String,
        required: true,
      },
    },
    bankInfo: {
      accountHolder: {
        type: String,
        required: true,
      },
      token: {
        type: String,
        required: false,
        unique: true,
      },
      last4: {
        type: String,
        required: true,
      },
    },
    walletAddress: {
      street_address: {
        type: String,
        required: true,
      },
      address_line2: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      zipcode: {
        type: Number,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
    },
  },
  { timestamps: true }
);

walletSchema.statics.findWalletById = function (_id: string) {
  return this.findOne({ _id }).populate({ path: "userId", model: "User" });
};

const Wallet = model<IWalletModel & IWalletDocument>("Wallet", walletSchema);
export default Wallet;
