import mongoose, { Document, Schema } from "mongoose";

export interface IShare extends Document {
  roomId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId; 
  platform: SharePlatform;
  shareType: ShareType;
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

export enum SharePlatform {
  FACEBOOK = "facebook",
  TIKTOK = "tiktok",
  SMS = "sms",
  IN_APP_MESSAGE = "in_app_message"
}

export enum ShareType {
  ROOM_ACCESS = "room_access",
  PURCHASE = "purchase",
  ENTRY = "entry"
}

const ShareSchema = new Schema<IShare>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Rooms",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true
    },
    platform: {
      type: String,
      enum: Object.values(SharePlatform),
      required: true,
      index: true
    },
    shareType: {
      type: String,
      enum: Object.values(ShareType),
      required: true,
      default: ShareType.ROOM_ACCESS
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

ShareSchema.index({ roomId: 1, platform: 1 });
ShareSchema.index({ createdAt: -1 });
ShareSchema.index({ "analytics.clicks": -1 });

export default mongoose.model<IShare>("Share", ShareSchema);
