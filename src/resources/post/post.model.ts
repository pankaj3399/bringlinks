import mongoose, { model, Schema } from "mongoose";
import { IPostDocument, IPostModel } from "./post.interface";
import { Types } from "../user/user.interface";

// Only User can create post
const PostSchema = new Schema<IPostDocument>(
  {
    // content of post
    content: {
      name: {
        type: String,
        trim: true,
      },
      url: {
        type: String,
        trim: true,
      },
    },
    // date and time of post
    date: {
      type: Date,
      default: function (this: IPostDocument) {
        return this.date ? this.date : Date.now();
      },
    },
    // number of likes
    likes_count: {
      type: Number,
      default: 0,
    },
    postedLocation: {
      type: {
        type: String,
        enum: Types,
        default: Types.Point,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    // likes of post
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Likes",
      },
    ],
    // comments of post
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comments",
      },
    ],
    // user sending post
    user_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rooms",
    },
    stats: {
      views: {
        type: Number,
        default: 0,
      },
      timeViewed: {
        type: Number,
        default: 0,
      },
      score: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true, minimize: false }
);

PostSchema.index({ postedLocation: "2dsphere" });

PostSchema.statics.findPostById = function (_id: string) {
  return this.findOne({ _id });
};

PostSchema.statics.deletePostById = function (_id: string) {
  return this.findByIdAndDelete({ _id });
};

const Posts = model<IPostDocument, IPostModel>("Posts", PostSchema);
export default Posts;
