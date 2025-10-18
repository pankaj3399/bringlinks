import Wallet from "./wallet.model";
import { IWalletDocument } from "./wallet.interface";
import mongoose from "mongoose";
import Logging from "../../library/logging";
import User from "../../resources/user/user.model";

export const getWalletById = async (_id: string) => {
  try {
    const foundedWallet = await Wallet.findById(_id);

    if (!foundedWallet) throw new Error("Wallet not found");
    return foundedWallet.populate({ path: "userId", model: "User" });
  } catch (err: any) {
    throw err;
  }
};

export const createWallet = async (
  wallet: IWalletDocument,
  user_id: string
) => {
  try {
    const userId = user_id as string;

    const createdWallet = await Wallet.create(wallet);
    if (!createdWallet) throw new Error("Wallet is not created");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $addToSet: {
          wallet: createdWallet._id,
        },
      }
    ).populate({ path: "wallet", model: "Wallet" });

    if (!updatedUser) throw new Error("Wallet is not updated");
    return createdWallet;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const updateWallet = async (walletId: string, updates: Partial<IWalletDocument>) => {
  try {
    const foundedWallet = await Wallet.findByIdAndUpdate(
      { _id: walletId },
      updates,
      { new: true }
    );

    if (!foundedWallet) throw new Error("Wallet is not updated");
    return foundedWallet;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const deleteWallet = async (wallet_id: string, user_id: string) => {
  try {
    const userId = user_id as string;
    const walletId = wallet_id as string;

    const foundedWallet = await Wallet.findById(walletId);
    if (!foundedWallet) throw new Error("Wallet not found");

    const deletedWallet = await Wallet.deleteOne({ _id: walletId });
    if (!deletedWallet) throw new Error("Wallet not deleted");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $pull: {
          wallet: walletId,
        },
      }
    );

    if (!updatedUser) throw new Error("User wallet not updated");
    return updatedUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};