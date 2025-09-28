import mongoose, { Document } from "mongoose";

export interface ILikes extends Document {
  posts: mongoose.Schema.Types.ObjectId;
  user_Id: mongoose.Schema.Types.ObjectId;
}
