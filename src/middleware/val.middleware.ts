import { Request, Response, NextFunction, RequestHandler } from "express";
import Joi from "joi";
import { IComments } from "resources/comments/comments.interface";
import { ILikes } from "resources/likes/likes.interface";
import { IRooms } from "resources/room/room.interface";
import { IUserPreferences, IUsers } from "../resources/user/user.interface";
import Logging from "../library/logging";
import { IChats } from "resources/chats/chats.interface";
import { IPaidRooms } from "resources/room/paidRooms/paidRoom.interface";
import { Iitinerary } from "resources/room/itinerary/itinerary.interface";
import { IFriends } from "resources/user/friends/friends.interface";
import { IReport } from "resources/report/report.interface";
import {
  ICreatorSignupRequest,
  ICreatorRegistrationRequest,
} from "../resources/user/creator/creator.interface";

function ValidationMiddleware(
  schema: Joi.Schema<
    | IUsers
    | IRooms
    | IComments
    | ILikes
    | IChats
    | IPaidRooms
    | Iitinerary
    | IFriends
    | IUserPreferences
    | Partial<IReport>
    | ICreatorSignupRequest
    | ICreatorRegistrationRequest
  >
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const validationOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };
    try {
      const value = await schema.validateAsync(req.body, validationOptions);
      req.body = value;
      next();
    } catch (err: any) {
      const errors: string[] = [];
      err.details.forEach((error: Joi.ValidationErrorItem) => {
        errors.push(error.message);
      });
      res.status(400).send({ errors });
    }
  };
}

export default ValidationMiddleware;
