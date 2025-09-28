import mongoose, { Document, Model } from "mongoose";

export interface IWallet extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cardInfo: CardInfoType;
  bankInfo: BankInfoType;
  walletAddress: walletAddressType;
  createdAt: Date;
  updatedAt: Date;
}

export type CardInfoType = {
  token: string;
  last4: string;
  accountHolder: string;
};

export type BankInfoType = {
  token: string;
  accountHolder: string;
  last4: string;
};

export type walletAddressType = {
  street_address: string;
  address_line2?: string;
  city: string;
  state: string;
  zipcode: number;
  country: string;
};

export interface IWalletDocument extends IWallet {
  // instance queries
  findWalletById: (_id: string) => Promise<IWalletDocument>;
}

export interface IWalletModel extends Model<IWalletDocument> {
  // Schema Queries
  findWalletById: (_id: string) => Promise<IWalletDocument>;
}
