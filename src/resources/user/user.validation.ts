import * as Joi from "joi";
import {
  Culture,
  CurrentLo,
  Demo,
  favoriteCityState,
  favoriteTypesOfRoomsType,
  GenderType,
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
  signupCode: Joi.string().length(6).alphanum().required(),
  state: Joi.string().trim().required(),
  profile: Joi.object<IUserProfile>().keys({
    firstName: Joi.string().min(3).max(30).required(),
    lastName: Joi.string().min(3).max(30).required(),
    birthDate: Joi.date().required(),
    occupation: Joi.string().min(3).max(30).required(),
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
        .required(),
      culture: Joi.string()
        .valid(Culture.rural, Culture.suburan, Culture.urban, Culture.noAnswer)
        .optional(),
      age: Joi.number().min(7).max(120).optional(),
      gender: Joi.string()
        .valid(
          GenderType.Male,
          GenderType.Female,
          GenderType.Transgender,
          GenderType.NonBinary,
          GenderType.NoAnswer
        )
        .required(),
    }),
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
    privacy: Joi.string().valid(ProfilePrivacy.private, ProfilePrivacy.public),
  }),
});

const requestPasswordChange = Joi.object<IUserDocument>().keys({
  auth: Joi.object<IAuth>().keys({
    email: Joi.string().email().required(),
  }),
});

const userPreferences = Joi.object<IUserPreferences>().keys({
  favoriteTypesOfRooms: Joi.array().optional(),
  favoriteCityState: Joi.array().optional(),
});

export default {
  create,
  userPreferences,
  changePassword,
  deleteUser,
  loginUser,
  updateUser,
  requestPasswordChange,
};
