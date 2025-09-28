import Joi from "joi";
import { ObjectId } from "mongoose";

const createPost = Joi.object().keys({
  content: Joi.string<string>().min(0).max(200).required(),
});

const updatePost = Joi.object().keys({
  content: Joi.string<string>().min(0).max(200).required(),
});

const getNearPost = Joi.object().keys({
  location: Joi.object().keys({
    type: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.number()).required(),
    venue: Joi.string().optional(),
  }),
});
export default { createPost, updatePost, getNearPost };
