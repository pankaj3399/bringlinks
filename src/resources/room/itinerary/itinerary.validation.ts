import * as Joi from "joi";
import { Iitinerary } from "./itinerary.interface";

const createItinerary = Joi.object<Iitinerary>().keys({
  name: Joi.string<string>().min(2).max(30).required(),
  roomId: Joi.string<string>().required(),
  url: Joi.string<string>(),
  time: Joi.string<string>().required(),
  date: Joi.string<string>().required(),
  location: Joi.string<string>().required(),
  cost: Joi.number().required(),
  description: Joi.string<string>().required(),
  venue: Joi.string<string>().required(),
  image: Joi.object().keys({
    name: Joi.string<string>().required(),
    url: Joi.string<string>().required(),
  }),
  address: Joi.object().keys({
    street_address: Joi.string<string>().required(),
    city: Joi.string<string>().required(),
    state: Joi.string<string>().required(),
    zipcode: Joi.string<string>().required(),
    country: Joi.string<string>().required(),
    coordinates: Joi.array<number>().max(2),
  }),
});

const updateItinerary = Joi.object<Iitinerary>().keys({
  _id: Joi.string<string>().required(),
  name: Joi.string<string>().min(2).max(30).required(),
  roomId: Joi.string<string>().required(),
  url: Joi.string<string>(),
  time: Joi.string<string>().required(),
  date: Joi.string<string>().required(),
  location: Joi.string<string>().required(),
  cost: Joi.number().required(),
  description: Joi.string<string>().required(),
  venue: Joi.string<string>().required(),
  image: Joi.object().keys({
    name: Joi.string<string>().required(),
    url: Joi.string<string>().required(),
  }),
  address: Joi.object().keys({
    street_address: Joi.string<string>().required(),
    city: Joi.string<string>().required(),
    state: Joi.string<string>().required(),
    zipcode: Joi.string<string>().required(),
    country: Joi.string<string>().required(),
    coordinates: Joi.array<number>().max(2),
  }),
});

export default {
  createItinerary,
  updateItinerary,
};
