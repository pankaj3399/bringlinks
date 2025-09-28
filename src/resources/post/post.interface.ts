import mongoose, { Document, Model } from "mongoose";
import { IMGNames } from "resources/room/room.interface";
import { CurrentLo } from "resources/user/user.interface";

export interface IPost extends Document {
  content: IMGNames;
  date: Date | number;
  likes_count: number;
  user_Id?: mongoose.Types.ObjectId;
  room_Id?: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];
  comments: mongoose.Types.ObjectId[];
  stats: StatsType;
  postedLocation: Pick<CurrentLo, "type" | "coordinates">;
}

export type StatsType = {
  views: number;
  timeViewed: number;
  score: number;
};

export interface IPostDocument extends IPost, Document {}

export interface IPostModel extends Model<IPostDocument> {
  findPostById: (_id: string) => Promise<IPostDocument>;
  deletePostById: (_id: string) => Promise<IPostDocument>;
}
