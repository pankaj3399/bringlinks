import Joi from "joi";

const generateCode = Joi.object({
  maxUsages: Joi.number().integer().min(1).max(10000).required(),
  expiresAt: Joi.date().greater("now").optional(),
});

const validateCode = Joi.object({
  code: Joi.string().length(6).alphanum().required(),
});

const requestCode = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  message: Joi.string().max(1000).optional(),
  email: Joi.string().email().required(),
});

const updateCode = Joi.object({
  maxUsages: Joi.number().integer().min(1).max(10000).optional(),
  isActive: Joi.boolean().optional(),
  expiresAt: Joi.date().greater("now").optional().allow(null),
});

const sendSignupCodeRequestEmail = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  message: Joi.string().max(1000).optional(),
  email: Joi.string().email().required(),
  code: Joi.string().length(6).alphanum().required(),
  status: Joi.string().valid("approved", "rejected").required(),
});

export default {
  generateCode,
  validateCode,
  requestCode,
  updateCode,
  sendSignupCodeRequestEmail,
};
