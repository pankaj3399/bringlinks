import Logging from "../../library/logging";
import mongoose, { model, Schema } from "mongoose";
import {
  IMGNames,
  IRoomsDocument,
  IRoomsModel,
  RoomPrivacy,
  RoomTypes,
} from "./room.interface";
import { Types } from "../../resources/user/user.interface";
import { PaidRoomSchema } from "./paidRooms/paidRoom.model";
import { IPaidRooms, Tiers } from "./paidRooms/paidRoom.interface";

const IMG_Schema = new Schema<IMGNames>({
  name: {
    type: String,
    trim: true,
  },
  url: {
    type: String,
    trim: true,
  },
});

// export const IMGModel = model<IMGNames>("IMG", IMG_Schema);

const RoomSchema = new Schema<IRoomsDocument>(
  {
    event_admin: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
    ],
    event_type: {
      type: String,
      enum: RoomTypes,
      required: true,
      default: function (this: IRoomsDocument) {
        const checkEventType = this.event_type
          ? this.event_type
          : RoomTypes.other;
        return checkEventType;
      },
    },
    event_typeOther: {
      type: String,
      trim: true,
      maxlength: 30,
      required: function (this: IRoomsDocument) {
        const checkEventType =
          this.event_type !== RoomTypes.other ? false : true;
        return checkEventType;
      },
    },
    event_name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 40,
    },
    event_location_address: {
      street_address: {
        type: String,
        trim: true,
      },
      address_line2: {
        type: String,
        trim: true,
        required: false,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zipcode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
    },
    event_location: {
      type: {
        type: String,
        enum: Types,
        default: Types.Point,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      venue: { type: String },
    } as any,
    event_description: {
      type: String,
      trim: true,
      required: true,
      maxlength: 100,
    },
    event_schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    specialGuest: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        roomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Rooms",
        },
        specialGuest: {
          type: Boolean,
          default: false,
        },
        title: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          trim: true,
          required: true,
        },
      },
    ],
    event_sponsors: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        name: {
          type: String,
          trim: true,
          required: true,
        },
        companyUrl: {
          type: String,
          trim: true,
          required: true,
        },
        logo: {
          name: {
            type: String,
            trim: true,
            required: true,
          },
          url: {
            type: String,
            trim: true,
          },
        },
        description: {
          type: String,
          trim: true,
          required: true,
        },
      },
    ],
    event_venue_image: [IMG_Schema],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Posts",
      },
    ],
    event_flyer_img: {
      name: {
        type: String,
        trim: true,
      },
      url: {
        type: String,
        trim: true,
      },
    },
    event_media_img: [IMG_Schema],
    entered_id: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    event_PendingRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    event_privacy: {
      type: String,
      enum: RoomPrivacy,
      default: RoomPrivacy.public,
    },
    event_invitees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    chats: [
      {
        type: Schema.Types.ObjectId,
        ref: "Chats",
      },
    ],
    shares: [
      {
        type: Schema.Types.ObjectId,
        ref: "Share",
      },
    ],
    itinerary: [
      {
        type: Schema.Types.ObjectId,
        ref: "Itinerary",
      },
    ],
    expiresAt: {
      type: Date,
      default: function () {
        const room = this;
        return room.event_schedule.endDate.getTime() + 92 * 24 * 60 * 60 * 1000;
      },
    },
    venueVerification: {
      name: {
        type: String,
        trim: true,
      },
      url: {
        type: String,
        trim: true,
      },
    },
    created_user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    paid: {
      type: Boolean,
      default: false,
    },
    paidRoom: {
      type: Schema.Types.ObjectId,
      ref: "PaidRooms",
    },
    roomQRCode: {
      type: String,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    stats: {
      views: {
        type: Number,
        default: 0,
      },
      timeViewed: {
        type: Number,
        default: 0,
      },
      score: {
        type: Number,
        default: 0,
      },
      mostViewedTab: {
        type: String,
      },
    },
  },
  { timestamps: true, minimize: false }
);

RoomSchema.index({ event_location: "2dsphere" });
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RoomSchema.index({
  event_name: "text",
  event_type: "text",
  event_description: "text",
  event_location_address: "text",
  event_schedule: "text",
  event_typeOther: "text",
});
RoomSchema.index({ _id: 1, post: 1 });
RoomSchema.index({ _id: 1, event_PendingRequests: 1 });
RoomSchema.index({ _id: 1, event_invitees: 1 });

RoomSchema.statics.findRoomById = function (_id: string) {
  return this.findOne({ _id });
};

RoomSchema.statics.findRoomByName = function (roomName: string) {
  return this.findOne({ event_name: roomName });
};

RoomSchema.statics.deleteRoomById = function (_id: string) {
  return this.findByIdAndDelete({ _id });
};

const Rooms = model<IRoomsDocument, IRoomsModel>("Rooms", RoomSchema);
export default Rooms;
