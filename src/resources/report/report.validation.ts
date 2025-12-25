import Joi from "joi";
import { IMGNames } from "../room/room.interface";
import { IReport } from "./report.interface";

export const createReporting = Joi.object<Partial<IReport>>({
  userId: Joi.string().required(),
  reportType: Joi.string().required(),
  description: Joi.string().required(),
  reportedTicketId: Joi.string(),
  reportedRoomId: Joi.string(),
  reportedUserId: Joi.string(),
});

export const updateReporting = Joi.object<Partial<IReport>>({
  userId: Joi.string(),
  reportType: Joi.string(),
  description: Joi.string(),
  reportedTicketId: Joi.string(),
  reportedRoomId: Joi.string(),
  reportedUserId: Joi.string(),
});
