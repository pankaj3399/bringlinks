import Joi from "joi";
import { ObjectId } from "mongoose";

const createComment = Joi.object().keys({
  content: Joi.string().required(),
});

const updateComment = Joi.object().keys({
  content: Joi.string().required(),
  _id: Joi.string().required(),
});

export default { createComment, updateComment };
