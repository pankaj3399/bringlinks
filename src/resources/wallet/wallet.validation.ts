import * as Joi from "joi";
import { IWalletDocument } from "./wallet.interface";

const cardSchema = Joi.object().keys({
  cardNumber: Joi.string<string>().pattern(new RegExp(/^\d{13,19}$/)),
  cardHolder: Joi.string<string>().required(),
  cvv: Joi.string<string>().required(),
  expirationMonth: Joi.string<string>().pattern(new RegExp(/^\d{1,2}$/)),
  expirationYear: Joi.string<string>().pattern(new RegExp(/^\d{4}$/)),
});

const bankSchema = Joi.object().keys({
  accountHolder: Joi.string<string>().required(),
  accountType: Joi.string<string>().required(),
  bankAccountNumber: Joi.string<string>().pattern(new RegExp(/^\d{4,17}$/)),
  bankRoutingNumber: Joi.string<string>()
    .pattern(new RegExp(/^[0-9]{9}$/))
    .required(),
});

const createWallet = Joi.object<IWalletDocument>().keys({
  userId: Joi.string<string>().required(),
  firstName: Joi.string<string>().required(),
  lastName: Joi.string<string>().required(),
  email: Joi.string<string>().required(),
  phone: Joi.string<string>().required(),
  cardInfo: cardSchema.optional(),
  bankInfo: bankSchema.optional(),
  walletAddress: Joi.object<IWalletDocument["walletAddress"]>().keys({
    street_address: Joi.string<string>().required(),
    address_line2: Joi.string<string>().optional(),
    city: Joi.string<string>().required(),
    state: Joi.string<string>().required(),
    zipcode: Joi.number<number>().required(),
    country: Joi.string<string>().required(),
  }),
});

const updateWallet = Joi.object<IWalletDocument>().keys({
  userId: Joi.string<string>().required(),
  firstName: Joi.string<string>().required(),
  lastName: Joi.string<string>().required(),
  phone: Joi.string<string>().required(),
  cardInfo: cardSchema.optional(),
  bankInfo: bankSchema.optional(),
  walletAddress: Joi.object<IWalletDocument["walletAddress"]>().keys({
    street_address: Joi.string<string>().required(),
    address_line2: Joi.string<string>().optional(),
    city: Joi.string<string>().required(),
    state: Joi.string<string>().required(),
    zipcode: Joi.number<number>().required(),
    country: Joi.string<string>().required(),
  }),
});

export default {
  createWallet,
  updateWallet,
};
