import mongoose, { Document, Model } from "mongoose";
import { StatsType } from "../post/post.interface";

export interface IComments extends Document {
  content: string;
  user_id: mongoose.Schema.Types.ObjectId;
  post_Id: mongoose.Schema.Types.ObjectId;
  date: Date | number;
  likes_count: number;
  likes: mongoose.Schema.Types.ObjectId[];
  commentReply: mongoose.Schema.Types.ObjectId[];
  stats: StatsType;
}

export interface ICommentsDocument extends IComments, Document {
  // instance queries
}

export interface ICommentsModel extends Model<ICommentsDocument> {
  // Schema Queries
  findCommentById: (_id: string) => Promise<ICommentsDocument>;
  deleteCommentById: (_id: string) => Promise<ICommentsDocument>;
}
