import mongoose, { model, Schema } from "mongoose";
import { ChatTypes, IChats, IChatsDocument, IGroup } from "./chats.interface";

const groupSchema = new Schema<IGroup>({
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  chat_Id: { type: mongoose.Schema.Types.ObjectId, ref: "Chats" },
});

export const GroupModel = model<IGroup>("Group", groupSchema);

const ChatSchema = new Schema<IChatsDocument>({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  chatType: {
    type: String,
    enum: ChatTypes,
    required: true,
  },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  room_Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rooms",
  },
  message: {
    type: String,
    minlength: 1,
    required: true,
    trim: true,
  },
  timestamps: { type: Date, default: Date.now },
});

ChatSchema.index({ chatType: 1, sender: 1, receiver: 1 });

const Chats = model<IChats | IChatsDocument>("Chats", ChatSchema);
export default Chats;
