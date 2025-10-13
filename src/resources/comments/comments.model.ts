import mongoose, { model, Schema } from "mongoose";
import { IComments } from "./comments.interface";

const commentSchema = new Schema<IComments>(
  {
    content: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Posts",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

commentSchema.index({ post_Id: 1, date: -1 });
commentSchema.index({ user_id: 1, date: -1 });
commentSchema.index({ date: -1 });

const Comments = model<IComments>("Comments", commentSchema);
export default Comments;
