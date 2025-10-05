import mongoose, { model, Schema } from "mongoose";
import { ICreator, ICreatorDocument, ICreatorModel, StripeAccountStatus } from "./creator.interface";

const creatorSchema = new Schema<ICreatorDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    signupCode: {
      type: String,
      required: true,
    },
    portfolio: { type: String },
    socialMedia: [{ type: String }],
    experience: { type: String },
    stripeConnectAccountId: {
      type: String,
      unique: true,
      sparse: true, 
    },
    stripeAccountStatus: {
      type: String,
      enum: Object.values(StripeAccountStatus),
      default: StripeAccountStatus.PENDING,
    },
    stripeAccountLink: {
      type: String, 
    },
    reviews: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    createdRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rooms" }],
    userScore: { 
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    totalReviews: { type: Number, default: 0 },
    totalRoomsCreated: { type: Number, default: 0 },
    activeRooms: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalPayouts: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

creatorSchema.statics.findCreatorById = function (_id: string) {
  return this.findById(_id).populate("userId");
};

const Creator = model<ICreatorDocument, ICreatorModel>("Creator", creatorSchema);
export default Creator;