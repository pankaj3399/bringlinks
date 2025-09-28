import mongoose from "mongoose";
import { IReport } from "./report.interface";

const reportSchema = new mongoose.Schema<IReport>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  reportType: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  evidence: {
    name: {
      type: String,
    },
    url: {
      type: String,
      default: null,
    },
  },
  reportedTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PaidRooms",
  },
  reportedRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rooms",
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    required: true,
  },
  updatedAt: {
    type: Date,
    required: true,
  },
});

const Report = mongoose.model<IReport>("Report", reportSchema);
export default Report;
