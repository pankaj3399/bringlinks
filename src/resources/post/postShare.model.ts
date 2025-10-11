import mongoose, { Document, Schema } from "mongoose";

export interface IPostShare extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: PostSharePlatform;
  shareType: PostShareType;
  shareUrl: string;
  originalUrl: string;
  analytics: {
    clicks: number;
    shares: number;
    conversions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export enum PostSharePlatform {
  FACEBOOK = "facebook",
  TIKTOK = "tiktok",
  SMS = "sms",
  IN_APP_MESSAGE = "in_app_message"
}

export enum PostShareType {
  POST_SHARE = "post_share",
  POST_PROMOTION = "post_promotion"
}

const PostShareSchema = new Schema<IPostShare>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Posts",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    platform: {
      type: String,
      enum: Object.values(PostSharePlatform),
      required: true,
      index: true
    },
    shareType: {
      type: String,
      enum: Object.values(PostShareType),
      required: true,
      default: PostShareType.POST_SHARE
    },
    shareUrl: {
      type: String,
      required: true,
      unique: true
    },
    originalUrl: {
      type: String,
      required: true
    },
    analytics: {
      clicks: {
        type: Number,
        default: 0
      },
      shares: {
        type: Number,
        default: 0
      },
      conversions: {
        type: Number,
        default: 0
      }
    }
  },
  { timestamps: true }
);

PostShareSchema.index({ postId: 1, platform: 1 });
PostShareSchema.index({ userId: 1, platform: 1 });
PostShareSchema.index({ createdAt: -1 });

const PostShare = mongoose.model<IPostShare>("PostShare", PostShareSchema);

export default PostShare;




