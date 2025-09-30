import Joi from "joi";

const sendOtp = Joi.object({
  phoneNumber: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
});

const verifyOtp = Joi.object({
  phoneNumber: Joi.string().trim().required(),
  otp: Joi.string().length(6).required(),
});

// const appleSignin = Joi.object({
//   appleToken: Joi.string().required(),
// });

export default { sendOtp, verifyOtp };





