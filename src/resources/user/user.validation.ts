import * as Joi from "joi";
import {
  Culture,
  CurrentLo,
  Demo,
  favoriteCityState,
  favoriteTypesOfRoomsType,
  IAuth,
  IUserDocument,
  IUserPreferences,
  IUserProfile,
  Location,
  Miles,
  ProfilePrivacy,
  Race,
} from "./user.interface";
import c from "config";
import { RoomTypes } from "../../resources/room/room.interface";

// Validation for services
const create = Joi.object<IUserDocument>().keys({
  auth: Joi.object<IAuth>().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z0-9]{3,30}$/))
      .min(8)
      .max(30)
      .required(),
    email: Joi.string()
      .pattern(
        new RegExp(/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/)
      )
      .min(3)
      .required(),
  }),
  signupCode: Joi.string().length(6).alphanum().optional(),
  state: Joi.string().trim().required(),
  profile: Joi.object<IUserProfile>().keys({
    firstName: Joi.string().min(3).max(30).required(),
    lastName: Joi.string().min(3).max(30).required(),
    birthDate: Joi.date().required(),
    occupation: Joi.string().min(3).max(30).optional(),
    location: Joi.object<Location>().keys({
      radiusPreference: Joi.number()
        .valid(
          Miles.TEN,
          Miles.THiRTY,
          Miles.FIFTY,
          Miles.SEVENTY_FIVE,
          Miles.ONE_HUNDRED
        )
        .required(),
      currentLocation: Joi.object<CurrentLo>().keys({
        type: Joi.string().optional(),
        coordinates: Joi.array<number>().max(2).required(),
        venue: Joi.string().optional(),
      }),
    }),
    privacy: Joi.string().valid(ProfilePrivacy.private, ProfilePrivacy.public),
    demographic: Joi.object<Demo>().keys({
      race: Joi.string()
        .valid(
          Race.asian,
          Race.black,
          Race.latino,
          Race.nativeAmerican,
          Race.pacificIslander,
          Race.twoOrMore,
          Race.white,
          Race.noAnswer
        )
        .optional(),
      culture: Joi.string()
        .valid(Culture.rural, Culture.suburan, Culture.urban, Culture.noAnswer)
        .optional(),
      age: Joi.number().min(7).max(120).optional(),
    }),
  }),
});

const deleteUser = Joi.object().keys({
  auth: Joi.object<IAuth>().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z0-9]{3,30}$/))
      .min(8)
      .max(30)
      .required(),
  }),
});

const changePassword = Joi.object().keys({
  auth: Joi.object<IAuth>().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z0-9]{3,30}$/))
      .min(8)
      .max(30)
      .required(),
  }),
});

const loginUser = Joi.object<IUserDocument>().keys({
  auth: Joi.object<IAuth>().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z0-9]{3,30}$/))
      .min(8)
      .max(30)
      .required(),
  }),
});

const updateUser = Joi.object<IUserDocument>().keys({
  auth: Joi.object<IAuth>().keys({
    username: Joi.string().alphanum().min(3).max(30),
  }),
  profile: Joi.object<IUserProfile>().keys({
    occupation: Joi.string().min(3).max(30),
    location: Joi.object<Location>().keys({
      radiusPreference: Joi.number()
        .valid(
          Miles.TEN,
          Miles.THiRTY,
          Miles.FIFTY,
          Miles.SEVENTY_FIVE,
          Miles.ONE_HUNDRED
        )
        .required(),
      currentLocation: Joi.object<CurrentLo>().keys({
        coordinates: Joi.array<number>().max(2).required(),
      }),
    }),
    demographic: Joi.object<Demo>().keys({
      race: Joi.string()
        .valid(
          Race.asian,
          Race.black,
          Race.latino,
          Race.nativeAmerican,
          Race.pacificIslander,
          Race.twoOrMore,
          Race.white,
          Race.noAnswer
        )
        .optional(),
      culture: Joi.string()
        .valid(Culture.rural, Culture.suburan, Culture.urban, Culture.noAnswer)
        .optional(),
    }),
    privacy: Joi.string().valid(ProfilePrivacy.private, ProfilePrivacy.public),
  }),
});

export default {
  create,
  changePassword,
  deleteUser,
  loginUser,
  updateUser,
};
