import mongoose, { Document } from "mongoose";

export interface IChats extends Document {
  sender: mongoose.Schema.Types.ObjectId;
  receiver?: mongoose.Schema.Types.ObjectId;
  group?: mongoose.Schema.Types.ObjectId;
  chatType: ChatTypes;
  room_Id?: mongoose.Schema.Types.ObjectId;
  message: string;
  timestamps: Date;
}

export type IGroup = {
  members: mongoose.Schema.Types.ObjectId[];
  chat_Id: mongoose.Schema.Types.ObjectId;
};
export enum ChatTypes {
  user = "userToUser",
  group = "group",
  room = "room",
}

export interface IChatsDocument extends IChats {
  // for chat methods
}
