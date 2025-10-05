import * as Joi from "joi";
import { ICreatorRegistrationRequest, ICreatorSignupRequest } from "./creator.interface";

export const creatorRegistration = Joi.object<ICreatorRegistrationRequest>().keys({
  userId: Joi.string().required(),
  signupCode: Joi.string().required(),
  portfolio: Joi.string().uri().optional(),
  socialMedia: Joi.array().items(Joi.string().uri()).optional(),
  experience: Joi.string().min(10).max(500).optional(),
});

export const creatorSignup = Joi.object<ICreatorSignupRequest>().keys({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  state: Joi.string().min(2).max(50).required(),
  signupCode: Joi.string().required(),
  portfolio: Joi.string().uri().optional(),
  socialMedia: Joi.array().items(Joi.string().uri()).optional(),
  experience: Joi.string().min(10).max(500).optional(),
});

export const stripeConnectOnboarding = Joi.object().keys({
  returnUrl: Joi.string().uri().required(),
  refreshUrl: Joi.string().uri().required(),
});

export default {
  creatorRegistration,
  creatorSignup,
  stripeConnectOnboarding,
};