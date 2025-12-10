import * as Joi from "joi";
import mongoose from "mongoose";

const getReceiptsQuery = Joi.object().keys({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

const getReceiptByIdParams = Joi.object().keys({
  receiptId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .required()
    .messages({
      "any.invalid": "Receipt ID must be a valid MongoDB ObjectId",
    }),
});

const getRoomReceiptsQuery = Joi.object().keys({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

export default {
  getReceiptsQuery,
  getReceiptByIdParams,
  getRoomReceiptsQuery,
};
