import UserReceipt from "./receipt.model";
import Logging from "../../library/logging";
import Rooms from "../room/room.model";
import mongoose from "mongoose";

export const getUserReceipts = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
) => {
  try {
    const skip = (page - 1) * limit;

    const receipts = await UserReceipt.find({ userId })
      .populate("roomId", "name description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = receipts.length > limit;
    const resultReceipts = hasMore ? receipts.slice(0, limit) : receipts;

    const total = await UserReceipt.countDocuments({ userId });

    return {
      receipts: resultReceipts,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    Logging.error(`Get user receipts error: ${error.message}`);
    throw new Error(`Failed to get user receipts: ${error.message}`);
  }
};

export const getReceiptById = async (receiptId: string, userId: string) => {
  try {
    const receipt = await UserReceipt.findById(receiptId).populate(
      "roomId",
      "name description",
    );

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Check if user owns this receipt
    if (String(receipt.userId) !== String(userId)) {
      throw new Error("Unauthorized: You can only access your own receipts");
    }

    return receipt;
  } catch (error: any) {
    Logging.error(`Get receipt by ID error: ${error.message}`);
    throw error;
  }
};

export const getRoomReceipts = async (
  roomId: string,
  userId: string,
  page: number = 1,
  limit: number = 20,
) => {
  try {
    // Verify user is the room creator/admin
    const room = await Rooms.findById(roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    const roomCreatorId = String((room as any).created_user);
    if (roomCreatorId !== String(userId)) {
      throw new Error(
        "Unauthorized: You can only access receipts for rooms you created",
      );
    }

    const skip = (page - 1) * limit;

    const receipts = await UserReceipt.find({ roomId })
      .populate("userId", "profile.firstName profile.lastName auth.email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = receipts.length > limit;
    const resultReceipts = hasMore ? receipts.slice(0, limit) : receipts;

    const total = await UserReceipt.countDocuments({ roomId });

    return {
      receipts: resultReceipts,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    Logging.error(`Get room receipts error: ${error.message}`);
    throw error;
  }
};
