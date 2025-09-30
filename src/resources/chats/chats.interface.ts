import mongoose, { Document } from "mongoose";

export interface IMediaMessage{
  type: 'image' | 'voice' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number; 
  thumbnail?: string; 
}

export interface IChats extends Document {
  sender: mongoose.Types.ObjectId;
  receiver?: mongoose.Types.ObjectId;
  group?: mongoose.Types.ObjectId;
  chatType: ChatTypes;
  room_Id?: mongoose.Types.ObjectId;
  message: string;
  media?: IMediaMessage;
  timestamps: Date;
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  replyTo?: mongoose.Types.ObjectId; 
}

export interface IGroup extends Document{
  name: string;
  description?: string;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  chat_Id: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ChatTypes {
  user = "userToUser",
  group = "group",
  room = "room",
}

export interface IChatsDocument extends IChats {
  // for chat methods
}

export interface ICreateGroupRequest {
  name: string;
  description?: string;
  members: string[];
  createdBy: string;
}

export interface IUpdateGroupRequest{
  groupId: string;
  name?: string;
  description?: string;
  members?: string[];
  admins?: string[];
}

export interface IMessageRequest {
  sender: string;
  receiver?: string;
  groupId?: string;
  roomId?: string;
  message: string;
  chatType: ChatTypes;
  media?: IMediaMessage;
  replyTo?: string;
}
