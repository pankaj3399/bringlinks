import * as Joi from "joi";

export const createFriend = Joi.object().keys({
  userId: Joi.string<string>().required(),
  friendId: Joi.string<string>().required(),
});
