import mongoose, { Document, Model } from "mongoose";

interface ICreator extends Document {
  userId: mongoose.Types.ObjectId;
  reviews: IReviews[];
  createdRooms: mongoose.Types.ObjectId[];
  userScore: Score;
  totalReviews: number;
  totalRoomsCreated: number;
  activeRooms: number;
}

export interface IReviews {
  roomId: mongoose.Types.ObjectId;
  overallRating: number;
  review: Review[];
}

export type Review = {
  roomId: mongoose.Types.ObjectId;
  rating: number;
  review: string;
};

export enum Score {
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
}

export interface CreatorDocument extends ICreator, Document {
  // instance queries
}

export interface CreatorModel extends Model<CreatorDocument> {
  // Schema Queries
  findCreatorById: (_id: string) => Promise<CreatorDocument>;
}
