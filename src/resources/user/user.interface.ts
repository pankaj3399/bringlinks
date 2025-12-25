import mongoose, { Document, Model } from "mongoose";
import { RoomTypes } from "resources/room/room.interface";

export interface IUsers extends Document {
  auth: IAuth;
  profile: IUserProfile;
  role: IRoles;
  refreshToken: string;
  phoneNumber?: string;
  state?: string;
  // otp?: string;
  // otpExpiry?: Date;
  isVerified?: boolean;
  signupCode?: string; // For registration validation only
  // appleId?: string;
  googleId?: string;
  pendingRoomsRequest: mongoose.Types.ObjectId[];
  enteredRooms: mongoose.Types.ObjectId[];
  userPreferences: IUserPreferences;
  created_rooms: mongoose.Types.ObjectId[];
  favoriteRooms: mongoose.Types.ObjectId[];
  friends: mongoose.Types.ObjectId[];
  friendsRequests: mongoose.Types.ObjectId[];
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  posts: mongoose.Types.ObjectId[];
  chats: mongoose.Types.ObjectId[];
  creator: mongoose.Types.ObjectId;
  wallet: mongoose.Types.ObjectId;
}

export enum Miles {
  TEN = 10,
  THiRTY = 30,
  FIFTY = 50,
  SEVENTY_FIVE = 75,
  ONE_HUNDRED = 100,
}

export interface IUserProfile {
  firstName: string;
  lastName: string;
  birthDate: Date;
  occupation: string;
  avi: AviPhoto;
  location: Location;
  privacy: ProfilePrivacy;
  demographic: Demo;
  bookmarks: bookmarkType[];
}

export type bookmarkType = {
  roomId?: mongoose.Types.ObjectId;
  postId?: mongoose.Types.ObjectId;
  commentId?: mongoose.Types.ObjectId;
};

export interface IAuth {
  username: string;
  password: string;
  email: string;
}

export enum IRoles {
  ADMIN = "ADMIN",
  CREATOR = "CREATOR",
  USER = "USER",
  ENTERPRISE = "ENTERPRISE",
}

export interface Location {
  radiusPreference: Miles;
  currentLocation: CurrentLo;
}

export interface AviPhoto {
  aviName: string;
  aviUrl: string;
}

export interface CurrentLo {
  type: Types.Point;
  coordinates: [number, number];
  venue: string;
}
export enum Types {
  Point = "Point",
  Polygon = "Polygon",
}
export interface Demo {
  gender: GenderType;
  race: Race;
  age: Number;
  culture: Culture;
}
export enum GenderType {
  Male,
  Female,
  Transgender,
  NonBinary,
  NoAnswer,
}

export enum Culture {
  urban = "URBAN",
  suburan = "SUBURBAN",
  rural = "RURAL",
  noAnswer = "",
}
export enum Race {
  black = "BLACK",
  latino = "LATINO",
  white = "WHITE",
  asian = "ASIAN",
  nativeAmerican = "NATIVE AMERICAN",
  pacificIslander = "PACIFIC ISLANDER",
  twoOrMore = "TWO OR MORE",
  noAnswer = "",
}
export enum ProfilePrivacy {
  public = "PUBLIC",
  private = "PRIVATE",
}
export interface IUserPreferences {
  favoriteTypesOfRooms?: favoriteTypesOfRoomsType[];
  favoriteCityState?: favoriteCityState[];
}
export type favoriteTypesOfRoomsType = {
  name: string;
  title: RoomTypes;
};

export type favoriteCityState = {
  formatedAddress: string;
};
export interface IUserDocument extends IUsers, Document {
  checkPassword: (password: string) => Promise<boolean>;
}

export interface IUserModel extends Model<IUserDocument> {
  findByUsername: (username: string) => Promise<IUserDocument>;
  findUserById: (_id: string) => Promise<IUserDocument>;
  deleteUserById: (_id: string) => Promise<IUserDocument>;
}
