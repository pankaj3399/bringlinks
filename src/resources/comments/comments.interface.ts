import mongoose, { Document } from "mongoose";

export interface IComments extends Document {
  content: String;
  user_id: mongoose.Schema.Types.ObjectId;
  post_Id: mongoose.Schema.Types.ObjectId;
  date: Date | number;
}
