import * as Joi from "joi";
import { ObjectId } from "mongoose";
import {
  Address,
  EventScheduleType,
  IMGNames,
  RoomPrivacy,
  RoomTypes,
} from "./room.interface";
import { CurrentLo } from "resources/user/user.interface";

// Validation for services
const createRoom = Joi.object().keys({
  event_admin: Joi.array<ObjectId>().items(Joi.string<ObjectId>()).required(),
  event_invitees: Joi.array<ObjectId>()
    .items(Joi.string<ObjectId>())
    .optional(),
  event_privacy: Joi.string()
    .valid(RoomPrivacy.private, RoomPrivacy.public)
    .required(),
  event_type: Joi.string<RoomTypes>().required(),
  event_typeOther: Joi.string<string>().min(3).max(30).optional(),
  event_name: Joi.string<string>().min(2).max(30).required(),
  event_location_address: Joi.object<Address>().keys({
    street_address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipcode: Joi.string()
      .pattern(new RegExp(/^(?!0{3})[0-9]{3,5}$/))
      .required(),
    country: Joi.string().required(),
  }),
  event_location: Joi.object<CurrentLo>().keys({
    type: Joi.string().optional(),
    coordinates: Joi.array<number>().max(2).required(),
    venue: Joi.string().optional(),
  }),
  event_description: Joi.string<string>().min(1).max(200).required(),
  event_schedule: Joi.object<EventScheduleType>().keys({
    startDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
    endDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
  }),
  paid: Joi.boolean().required(),
  paidRoom: Joi.string<ObjectId>().optional(),
});

const editARoom = Joi.object().keys({
  event_admin: Joi.array<ObjectId>().items(Joi.string<ObjectId>()),
  event_invitees: Joi.array<ObjectId>().items(Joi.string<ObjectId>()),
  event_privacy: Joi.string().valid(RoomPrivacy.private, RoomPrivacy.public),
  event_type: Joi.string<RoomTypes>().required(),
  event_typeOther: Joi.string<string>().min(3).max(15).optional(),
  event_name: Joi.string<string>().min(2).max(30).required(),
  event_location_address: Joi.object<Address>().keys({
    street_address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipcode: Joi.string()
      .pattern(new RegExp(/^(?!0{3})[0-9]{3,5}$/))
      .required(),
    country: Joi.string().required(),
  }),
  event_flyer_img: Joi.object<IMGNames>().keys({
    name: Joi.string<string>().required(),
  }),
  event_venue_image: Joi.array<string>().items(
    Joi.object<IMGNames>().keys({
      name: Joi.string<string>().required(),
    })
  ),
  event_description: Joi.string<string>().min(3).max(100).required(),
  event_schedule: Joi.object<EventScheduleType>().keys({
    startDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
    endDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
  }),
});

const getRoom = Joi.object().keys({
  _id: Joi.string<string>(),
  event_name: Joi.string<string>().min(2).max(40),
  event_type: Joi.string<RoomTypes>(),
  entered_id: Joi.string(),
  event_location_address: Joi.object<Address>().keys({
    city: Joi.string(),
    state: Joi.string(),
  }),
  event_schedule: Joi.object<EventScheduleType>().keys({
    startDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
    endDate: Joi.string<string>()
      .pattern(
        new RegExp(
          /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[\/\-\.]([0]?[1-9]|[1][0-2])[\/\-\.]([0-9]{4}|[0-9]{2})$/
        )
      )
      .required(),
  }),
});

const validateRoomFindBy = Joi.object({
  _id: Joi.string().optional(),
  event_name: Joi.string().optional(),
  event_type: Joi.string().optional(),
  event_location_address: Joi.object({
    city: Joi.string().optional(),
    state: Joi.string().optional(),
  }).optional(),
  entered_id: Joi.string().optional(),
  event_schedule: Joi.object({
    startDate: Joi.string().pattern(
      new RegExp(/^(1[0-2]|0?[1-9]):[0-5][0-9] [APap][Mm]$/)
    ),
    endDate: Joi.string().pattern(
      new RegExp(/^(1[0-2]|0?[1-9]):[0-5][0-9] [APap][Mm]$/)
    ),
  }).optional(),
  event_location: Joi.object({
    venue: Joi.string().optional(),
  }),
}).or(
  "_id",
  "event_name",
  "event_type",
  "event_location_address.city",
  "event_location_address.state",
  "entered_id",
  "event_location.category",
  "event_schedule.startDate",
  "event_schedule.endDate",
  "event_location.venue"
);

const addSpecialGuest = Joi.object().keys({
  userId: Joi.string<string>().required(),
  roomId: Joi.string<string>().required(),
  name: Joi.string<string>().required(),
  type: Joi.string<string>().required(),
});

const addSponsor = Joi.object().keys({
  name: Joi.string<string>().required(),
  companyUrl: Joi.string<string>().required(),
  logo: Joi.object().keys({
    name: Joi.string<string>().required(),
    url: Joi.string<string>().required(),
  }),
  description: Joi.string<string>().required(),
});

export default {
  createRoom,
  editARoom,
  getRoom,
  validateRoomFindBy,
  addSpecialGuest,
  addSponsor,
};
