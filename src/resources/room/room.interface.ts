import mongoose, { Document, Model } from "mongoose";
import { CurrentLo } from "resources/user/user.interface";

export interface IRooms extends Document {
  event_admin: mongoose.Types.ObjectId[];
  event_invitees: mongoose.Types.ObjectId[];
  event_PendingRequests: mongoose.Types.ObjectId[];
  created_user: mongoose.Types.ObjectId;
  event_privacy: RoomPrivacy;
  event_type: RoomTypes;
  event_typeOther: string | null;
  event_name: string;
  event_flyer_img: IMGNames;
  event_media_img: IMGNames[];
  specialGuest: SpecialGuestType[];
  event_sponsors: sponsorType[];
  entered_id: mongoose.Types.ObjectId[];
  posts: mongoose.Types.ObjectId[];
  chats: mongoose.Types.ObjectId[];
  shares: mongoose.Types.ObjectId[];
  event_location_address: Address;
  event_location: CurrentLo;
  event_venue_image: IMGNames[];
  event_description: string;
  roomQRCode: string;
  event_schedule: EventScheduleType;
  itinerary: mongoose.Types.ObjectId[];
  expiresAt: Date;
  paid: boolean;
  paidRoom: mongoose.Types.ObjectId;
  venueVerification: IMGNames;
  stats: StatsType;
}

export type sponsorType = {
  userId?: mongoose.Types.ObjectId;
  name: string;
  companyUrl: string;
  logo: IMGNames;
  description: string;
};

export type StatsType = {
  views: number;
  timeViewed: number;
  score: number;
  mostViewedTab: string;
};

export type SpecialGuestType = {
  userId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  type: string;
  name: string;
};

export interface IMGNames {
  name: string;
  url: string;
}
export interface Address {
  street_address: string;
  address_line2?: string;
  city: string;
  state: string;
  zipcode: number;
  country: string;
}

export type EventScheduleType = {
  startDate: Date;
  endDate: Date;
};
export interface TimeSchedule {
  date: Date;
  time: string;
}

export enum RoomPrivacy {
  private = "PRIVATE",
  public = "PUBLIC",
}

export enum RoomTypes {
  basketball = "Pick Up Basketball",
  clubs = "Clubbing",
  studyGroups = "Study Groups",
  flagFootball = "Flag Football",
  gameNights = "Game Nights",
  party = "Party",
  KickBack = "Kick Back",
  videoGames = "Video Games",
  skateboard = "Skateboarding",
  funeral = "Funeral",
  wedding = "Wedding",
  other = "Other",
}

export interface IRoomsDocument extends IRooms, Document {
  // instance queries
}

export interface IRoomsModel extends Model<IRoomsDocument> {
  // Schema Queries
  findRoomByName: (username: string) => Promise<IRoomsDocument>;
  findRoomById: (_id: string) => Promise<IRoomsDocument>;
  deleteRoomById: (_id: string) => Promise<IRoomsDocument>;
}
