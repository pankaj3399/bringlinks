import mongoose, { Document } from "mongoose";

export interface IFriends extends Document {
  userId: mongoose.Types.ObjectId;
  friendId: mongoose.Types.ObjectId;
  createdAt: Date;
}
