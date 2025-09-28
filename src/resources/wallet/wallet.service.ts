import Wallet from "./wallet.model";
import { IWalletDocument } from "./wallet.interface";
import mongoose from "mongoose";
import Logging from "../../library/logging";
import User from "../../resources/user/user.model";
var toId = mongoose.Types.ObjectId;

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
    const userId = new toId(user_id);

    const createdWallet = await Wallet.create(wallet);
    if (!createdWallet) throw new Error("Wallet is not created");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: createdWallet._id },
      {
        $addToSet: {
          wallet: createdWallet._id,
        },
      }
    ).populate({ path: "wallet", model: "Wallet" });

    if (!updatedUser) throw new Error("Wallet is not updated");
    return updatedUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const updateWallet = async (wallet: IWalletDocument) => {
  try {
    const foundedWallet = await Wallet.findByIdAndUpdate(
      { _id: wallet._id },
      wallet
    );

    if (!foundedWallet) throw new Error("Wallet not updated");
    return foundedWallet;
  } catch (err: any) {
    throw err;
  }
};

export const deleteWallet = async (user_id: string, wallet_id: string) => {
  try {
    const userId = new toId(user_id);
    const walletId = new toId(wallet_id);

    // 90 days
    const deletedWallet = await Wallet.findByIdAndUpdate(walletId, {
      deleteAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    }).exec();

    if (!deletedWallet) throw new Error("Wallet not deleted");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $pull: { wallet: walletId },
      }
    ).populate({ path: "wallet", model: "Wallet" });

    if (!updatedUser) throw new Error("Wallet not deleted");
    return deletedWallet;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
