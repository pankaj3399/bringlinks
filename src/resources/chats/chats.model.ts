import mongoose, { model, Schema } from "mongoose";
import { ChatTypes, IChats, IChatsDocument, IGroup, IMediaMessage } from "./chats.interface";

const mediaMessageSchema = new Schema<IMediaMessage>({
  type: { type: String, enum: ['image', 'voice', 'video'], required: true },
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number }, 
  thumbnail: { type: String }, 
}, { _id: false });

const groupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  chat_Id: { type: mongoose.Schema.Types.ObjectId, ref: "Chats" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

groupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const GroupModel = model<IGroup>("Group", groupSchema);

const ChatSchema = new Schema<IChatsDocument>({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
  media: { type: mediaMessageSchema },
  timestamps: { type: Date, default: Date.now },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Chats" },
});

ChatSchema.index({ chatType: 1, sender: 1, receiver: 1 });
ChatSchema.index({ group: 1, timestamps: -1 });
ChatSchema.index({ room_Id: 1, timestamps: -1 });
ChatSchema.index({ sender: 1, receiver: 1, timestamps: -1 });

const Chats = model<IChats | IChatsDocument>("Chats", ChatSchema);
export default Chats;
