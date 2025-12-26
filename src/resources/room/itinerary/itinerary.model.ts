import { model, Schema } from "mongoose";
import { ItineraryDocument, ItineraryModel } from "./itinerary.interface";

const ItinerarySchema = new Schema<ItineraryDocument>({
  name: {
    type: String,
    trim: true,
    required: true,
  },
  url: {
    type: String,
    trim: true,
    required: true,
  },
  time: {
    type: String,
    trim: true,
    required: true,
  },
  date: {
    type: String,
    trim: true,
    required: true,
  },
  location: {
    type: String,
    trim: true,
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    required: true,
  },
  venue: {
    type: String,
    trim: true,
  },
  image: {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    url: {
      type: String,
      trim: true,
      required: true,
    },
  },
  address: {
    street_address: {
      type: String,
      trim: true,
      required: true,
    },
    city: {
      type: String,
      trim: true,
      required: true,
    },
    state: {
      type: String,
      trim: true,
      required: true,
    },
    zipcode: {
      type: String,
      trim: true,
      required: true,
    },
    country: {
      type: String,
      trim: true,
      required: true,
    },
    coordinates: {
      type: [Number],
    },
  },
  roomId: {
    type: Schema.Types.ObjectId,
    ref: "Rooms",
    required: true,
  },
});

ItinerarySchema.statics.findItineraryById = function (_id: string) {
  const itineraryId = _id as string;
  return this.findOne({ _id: itineraryId });
};

const Itinerary = model<ItineraryDocument, ItineraryModel>(
  "Itinerary",
  ItinerarySchema
);
export default Itinerary;
