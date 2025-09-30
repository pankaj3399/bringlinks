import Joi from "joi";
import { ObjectId } from "mongoose";
import { IChatsDocument } from "./chats.interface";

export const createChat = Joi.object<IChatsDocument>().keys({
  sender: Joi.string<ObjectId>().required(),
  receiver: Joi.string<ObjectId>().optional(),
  group: Joi.string<ObjectId>().optional(),
  chatType: Joi.string().valid("user", "group", "room").required(),
  room_Id: Joi.string().optional(),
  message: Joi.string().min(1).required(),
});

export const createGroupValidation = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  members: Joi.array().items(Joi.string()).min(1).required(),
});

export const updateGroupValidation = Joi.object({
  groupId: Joi.string().required(),
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  members: Joi.array().items(Joi.string()).optional(),
  admins: Joi.array().items(Joi.string()).optional(),
});

export const addMemberValidation = Joi.object({
  groupId: Joi.string().required(),
  userId: Joi.string().required(),
});

export const removeMemberValidation = Joi.object({
  groupId: Joi.string().required(),
  userId: Joi.string().required(),
});

export const editMessageValidation = Joi.object({
  messageId: Joi.string().required(),
  message: Joi.string().min(1).required(),
});

export const deleteMessageValidation = Joi.object({
  messageId: Joi.string().required(),
});

export const getChatHistoryValidation = Joi.object({
  chatType: Joi.string().valid("userToUser", "group", "room").required(),
  targetId: Joi.string().required(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(50),
});

export const uploadMediaValidation = Joi.object({
  mediaType: Joi.string().valid("image", "voice", "video").required(),
});
