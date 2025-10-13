import mongoose, { model, Schema } from "mongoose";
import { ILikes } from "./likes.interface";

const LikeSchema = new Schema<ILikes>(
  {
    posts: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Posts",
      required: true,
    },
    user_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

LikeSchema.index({ posts: 1, user_Id: 1 }, { unique: true }); 
LikeSchema.index({ posts: 1 });
LikeSchema.index({ user_Id: 1 });

const Likes = model<ILikes>("Likes", LikeSchema);
export default Likes;
