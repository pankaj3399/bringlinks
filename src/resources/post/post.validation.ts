import Joi from "joi";
import { ObjectId } from "mongoose";

const createPost = Joi.object().keys({
  content: Joi.object().keys({
    name: Joi.string().min(1).max(200).required(),
    url: Joi.string().optional().allow(""),
  }).required(),
  postedLocation: Joi.object()
    .keys({
      type: Joi.string().valid("Point").optional(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      venue: Joi.string().optional(),
    })
    .required(),
});

const updatePost = Joi.object().keys({
  content: Joi.object().keys({
    name: Joi.string().min(0).max(200).required(),
    url: Joi.string().optional().allow(""),
  }).required(),
});

const getNearPost = Joi.object().keys({
  location: Joi.object().keys({
    type: Joi.string().optional(),
    coordinates: Joi.array().items(Joi.number()).required(),
    venue: Joi.string().optional(),
  }),
});
export default { createPost, updatePost, getNearPost };
