import mongoose, { Document, Model } from "mongoose";
import { Address, IMGNames } from "../room.interface";

export interface Iitinerary extends Document {
  name: string;
  roomId: mongoose.Types.ObjectId;
  url?: string;
  time: string;
  date: string;
  location: string;
  cost: number;
  description: string;
  venue: string;
  image: IMGNames;
  address: Address & {
    coordinates: number[];
  };
}

export interface ItineraryDocument extends Iitinerary, Document {
  // instance queries
}

export interface ItineraryModel extends Model<ItineraryDocument> {
  // Schema Queries
  findItineraryById: (_id: string) => Promise<ItineraryDocument>;
}
