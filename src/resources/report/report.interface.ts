import mongoose, { Document } from "mongoose";
import { IMGNames } from "resources/room/room.interface";

export interface IReport extends Document {
  userId: mongoose.Types.ObjectId;
  reportType: ReportType;
  description: string;
  evidence?: IMGNames;
  reportedTicketId?: mongoose.Types.ObjectId;
  reportedRoomId?: mongoose.Types.ObjectId;
  reportedUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportType =
  | "ticket purchase"
  | "room misconduct"
  | "user misconduct"
  | "ticket refund"
  | "ticket cancellation"
  | "room cancellation"
  | "user cancellation"
  | "room ownership";
