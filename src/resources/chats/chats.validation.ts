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
