import mongoose, { Schema, model } from "mongoose";
import {
  Culture,
  IRoles,
  IUserDocument,
  IUserModel,
  Miles,
  ProfilePrivacy,
  Race,
  Types,
} from "../user/user.interface";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
dotenv.config();
import config from "config";
import Logging from "../../library/logging";
import { RoomTypes } from "../room/room.interface";

const UserSchema = new Schema<IUserDocument>(
  {
    auth: {
      username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxLength: 32,
      },
      password: {
        type: String,
        required: true,
        trim: true,
        minLength: 6,
      },
      email: { type: String, trim: true, unique: true },
    },
    profile: {
      firstName: {
        type: String,
        required: true,
        maxlength: 32,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        maxlength: 32,
        trim: true,
      },
      birthDate: {
        type: Date,
        trim: true,
        required: true,
      },
      occupation: {
        type: String,
        maxlength: 30,
        trim: true,
      },
      location: {
        radiusPreference: {
          type: Number,
          enum: Miles,
          default: Miles.TEN,
        },
        currentLocation: {
          type: {
            type: String,
            enum: Types,
            default: "Point",
            required: false,
          },
          coordinates: {
            type: [Number],
            // required: true
          },
          venue: { type: String, default: "Home" },
        },
      },
      bookmarks: [
        {
          roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rooms",
          },
          postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Posts",
          },
          commentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comments",
          },
        },
      ],
      friendsRequests: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      privacy: {
        type: String,
        required: true,
        enum: ProfilePrivacy,
        // All Users Public for now
        default: ProfilePrivacy.public,
      },
      demographic: {
        race: {
          type: String,
          enum: Race,
          required: false,
        },
        age: {
          type: Number,
          min: [7, "age cant be lower than 7"],
          max: [120, "age cant be higher than 120"],
          required: false,
        },
        culture: {
          type: String,
          enum: Culture,
          required: false,
        },
      },
      avi: {
        aviName: {
          type: String,
        },
        aviUrl: {
          type: String,
        },
      },
    },
    role: {
      type: String,
      enum: IRoles,
    },
    refreshToken: {
      type: String,
    },
    pendingRoomsRequest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rooms",
      },
    ],
    enteredRooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rooms",
      },
    ],
    created_rooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rooms",
      },
    ],
    favoriteRooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rooms",
      },
    ],
    userPreferences: {
      type: Object,
      required: false,
      favoriteTypesOfRooms: [
        {
          name: {
            type: String,
            trim: true,
          },
          title: {
            type: RoomTypes,
            trim: true,
          },
        },
      ],
      favoriteCityState: [
        {
          formatedAddress: {
            type: String,
            trim: true,
          },
        },
      ],
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Friend",
      },
    ],
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Creator",
      required: function () {
        var user = this as IUserDocument;
        return user.role === IRoles.CREATOR ? true : false;
      },
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    posts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Posts",
      },
    ],
    chats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chats",
      },
    ],
  },
  { timestamps: true, minimize: false }
);
UserSchema.index({ "location.currentLocation": "2dsphere" });
UserSchema.index({
  "profile.username": 1,
});
UserSchema.index({ role: 1 });
UserSchema.index({ "profile.location.currentLocation": 1 });
UserSchema.index({ enteredRooms: 1 });
UserSchema.index({ followers: 1 });
UserSchema.index({ following: 1 });
UserSchema.index({ created_rooms: 1 });

export const UserCompare = (UserSchema.methods = {
  async comparePass(pass: string, password: string) {
    Logging.log(`entered ${pass}`);
    Logging.log(`Saved password: ${password}`);
    const comparedPass = await bcrypt.compare(pass, password);
    Logging.log(comparedPass);
    return comparedPass;
  },
});

const SetAge = (UserSchema.methods = {
  setAge(birthDate: Date): number {
    var today = new Date();
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  },
});

UserSchema.statics.findByUsername = function (username: string) {
  return this.findOne({ "auth.username": username });
};

UserSchema.statics.findUserById = function (_id: string) {
  return this.findOne({ _id }).select("-auth.password -role -refreshToken");
};
UserSchema.statics.deleteUserById = function (_id: string) {
  return this.findByIdAndDelete({ _id });
};
// UserSchema.pre("updateOne", async function (next) {
//   var user = this;

//   // update role if user is created rooms
//   if (user.exists("created_rooms")) {
//   next();
// });

UserSchema.pre("save", async function (next) {
  var user = this;

  if (!user.isModified("auth.password")) {
    return next();
  } else {
    const salt = await bcrypt.genSalt(Number(config.get("SaltRounds")));
    const hash = await bcrypt.hash(user.auth.password, salt);
    user.auth.password = hash;
    next();
  }

  if (!user.isModified("profile.birthDate")) {
    return next();
  } else {
    user.profile.demographic.age = SetAge.setAge(
      user.profile.birthDate
    ).valueOf();
    next();
  }

  next();
});

const User = model<IUserDocument, IUserModel>("User", UserSchema);
export default User;
