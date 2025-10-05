import mongoose, { Error } from "mongoose";
import { IRoles, IUserDocument } from "resources/user/user.interface";
import User from "../user/user.model";
import Logging from "../../library/logging";
import {
  IMGNames,
  IRoomsDocument,
  RoomPrivacy,
  SpecialGuestType,
  sponsorType,
} from "./room.interface";
import Rooms from "./room.model";
import { retrieveRoomIMG } from "../../utils/ImageServices/roomFlyer.Img";
import { FileType } from "../../utils/ImageServices/helperFunc.ts/room.Img";
import PaidRoom from "./paidRooms/paidRoom.model";
import { IPaidRooms, PricingTiers } from "./paidRooms/paidRoom.interface";
import { str } from "envalid";
import QRCode from "qrcode";
import { validateEnv } from "../../../config/validateEnv";


const getARoom = async (id: string) => {
  const _id = id as string;
  try {
    const foundedRoom = await Rooms.findById(_id);

    if (!foundedRoom) throw new Error("Room not found");
    return foundedRoom.populate({ path: "created_user", model: "User" });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const getRoomBy = async (room: IRoomsDocument, path: string) => {
  const _id = room._id as string;
  try {
    const foundedRoom = await Rooms.find({
      $or: [
        { _id },
        { event_name: room.event_name },
        { event_type: room.event_type },
        { event_typeOther: room.event_typeOther },
        {
          "event_location_address.city": room.event_location_address?.city,
        },
        {
          "event_location_address.state": room.event_location_address?.state,
        },
        {
          entered_id: room.entered_id,
        },
        {
          "event_location.venue": room.event_location?.venue,
        },
        {
          "event_schedule.startDate": room.event_schedule?.startDate,
        },
        {
          "event_schedule.endDate": room.event_schedule?.endDate,
        },
      ],
    })
      .clone()
      .populate(path);

    Logging.log(foundedRoom);

    if (!foundedRoom) throw new Error("Room not found");

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const getAllRooms = async () => {
  try {
    const allRooms = await Rooms.find().populate({
      path: "created_user",
      model: "User",
    });

    if (!allRooms) throw new Error("Room not found");

    return allRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const createRoom = async (
  room: IRoomsDocument,
  user_id: string,
  paidRoom: Partial<IPaidRooms | undefined> = undefined
) => {
  try {
    const created_user = user_id as string;

    const foundRoom = await Rooms.findOne({
      event_location_address: {
        street_address: room.event_location_address.street_address,
        address_line2: room.event_location_address.address_line2,
        city: room.event_location_address.city,
        state: room.event_location_address.state,
        zipcode: room.event_location_address.zipcode,
        country: room.event_location_address.country,
      },
    });

    if (foundRoom)
      return foundRoom.populate({
        path: "created_user",
        model: "User",
        select: "_id",
      });

    // normalize event_admin and dates before create
    const toObjectIdArray = (value: unknown): mongoose.Types.ObjectId[] => {
      if (!value) return [];
      const arr = Array.isArray(value) ? value : [value];
      return arr
        .filter(Boolean)
        .map((v) => new mongoose.Types.ObjectId(String(v)));
    };

    const parseDdmmyyyy = (v?: unknown): Date | undefined => {
      if (!v) return undefined;
      const s = String(v).trim();
      // Accept DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
      const m = s.match(/^([0]?[1-9]|[1|2][0-9]|3[0|1])[./-]([0]?[1-9]|1[0-2])[./-]([0-9]{4}|[0-9]{2})$/);
      if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1; // zero-based
        const y = parseInt(m[3].length === 2 ? `20${m[3]}` : m[3], 10);
        return new Date(Date.UTC(y, mo, d, 0, 0, 0));
      }
      // Fallback: let Date try to parse ISO or millis
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? undefined : dt;
    };

    const sanitized: Partial<IRoomsDocument> = {
      ...room,
      event_admin: toObjectIdArray((room as any).event_admin),
      event_invitees: toObjectIdArray((room as any).event_invitees),
      event_schedule: {
        startDate: parseDdmmyyyy((room as any).event_schedule?.startDate) as any,
        endDate: parseDdmmyyyy((room as any).event_schedule?.endDate) as any,
      } as any,
    };

    // create a room
    const createdRoom = await Rooms.create(sanitized);
    if (!createRoom) throw new Error("Room is not created");

    await Rooms.updateOne(
      { _id: createdRoom._id },
      { $addToSet: { created_user, entered_id: created_user, event_admin: created_user } }
    ).clone();

    await User.updateOne(
      { _id: created_user },
      {
        $addToSet: {
          created_rooms: createdRoom._id,
          enteredRooms: createdRoom._id,
        },
      },
      { new: true }
    ).exec();

    return await createdRoom.populate({
      path: "created_user",
      model: "User",
      select: "_id",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const createRoomQRCode = async (roomId: string) => {
  try {
    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    const roomQRData = {
      _id: room._id,
      roomName: room.event_name,
      roomType: room.event_type ? room.event_type : room.event_typeOther,
      roomLocation:
        room.event_location_address.street_address +
        ", " +
        room.event_location_address.city,
      paid: room.paid,
    };

    const roomInfo = JSON.stringify(roomQRData);
    const roomUrl = `${validateEnv.FRONTEND_URL}/room/${roomInfo}`;

    const qrCode = await QRCode.toDataURL(roomUrl);
    if (!qrCode) throw new Error("QR code not created");

    room.roomQRCode = qrCode;
    await room.save();

    return qrCode;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const getQRCode = async (roomId: string) => {
  try {
    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    return room.roomQRCode;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const getRoomsByText = async (roomQuery: string) => {
  try {
    const foundedRoom = await Rooms.find({
      $text: { $search: roomQuery },
    }).select("-event_location_address -event_location ");
    if (!foundedRoom) throw new Error("Room not found");
    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const addSpecialGuest = async (
  user_Id: string,
  addedGuest: Pick<SpecialGuestType, "userId" | "roomId" | "name" | "type">
) => {
  try {
    const roomId = String(addedGuest.roomId);
    const adminId = user_Id as string;
    const userId = String(addedGuest.userId);

    const foundedRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId, event_admin: adminId },
      {
        $addToSet: {
          specialGuest: {
            roomId,
            userId,
            name: addedGuest.name,
            type: addedGuest.type,
          },
        },
      }
    ).clone();

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const addSponsor = async (
  user_Id: string,
  room_Id: string,
  sponsor: sponsorType
) => {
  try {
    const roomId = room_Id as string;
    const userId = user_Id as string;

    const foundRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId, event_admin: userId },
      {
        $addToSet: {
          event_sponsors: sponsor,
        },
      }
    ).clone();

    return foundRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

// check if User Preferences matches with the room type and text description and in the same city
export const getRelatedRooms = async (user_id: string) => {
  try {
    const userId = user_id as string;

    const foundedUser = await User.findById(userId).select(
      "-auth.password -role -refreshToken"
    );
    if (!foundedUser) throw new Error("User not found");

    const userPreferences = foundedUser.userPreferences;

    const foundedRooms = await Rooms.find({
      $or: [
        // { event_typeOther: userPreferences.favoriteTypesOfRooms?.title },
        // { event_type: userPreferences.favoriteTypesOfRooms?.title },
        // {
        //   "event_location_address.city_state":
        //     userPreferences.favoriteCityState?.formatedAddress,
        // },
        // { event_description: userPreferences.favoriteTypesOfRooms?.name },
      ],
    }).select("-event_location_address -event_location ");

    if (!foundedRooms) throw new Error("Room not found");

    return foundedRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const deleteRoom = async (user_id: string, room_id: string) => {
  try {
    const roomId = room_id as string;
    const userId = user_id as string;

    const deletedRoom = await Rooms.findByIdAndUpdate(room_id, {
      deleteAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    });
    if (!deleteRoom) throw new Error("Room is deleted");

    await User.updateOne(
      { _id: userId },
      {
        $pull: { created_rooms: roomId },
      },
      { new: true }
    );

    return deletedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const updateRoom = async (
  room: IRoomsDocument,
  user_id: string,
  room_id: string
) => {
  try {
    const created_user = user_id as string;

    const foundedRoom = await Rooms.findByIdAndUpdate({ _id: room_id }, room);
    if (!foundedRoom) throw new Error("Room not found");

    if (!room.event_typeOther) {
      await Rooms.updateOne(
        { _id: room_id },
        {
          $set: { event_typeOther: null },
        }
      );
    }
    foundedRoom.created_user = new mongoose.Types.ObjectId(created_user) as any;
    if (!updateRoom) throw new Error("Room did not update");

    return foundedRoom.populate({
      path: "created_user",
      model: "User",
      select: "-auth.password -role",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const addAnAdmin = async (room_id: string, newAdmin: string) => {
  try {
    const roomId = room_id as string;

    const foundedRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $addToSet: { event_admin: newAdmin, entered_id: newAdmin },
      }
    )
      .populate({
        path: "created_user",
        model: "User",
        select: "-auth.password -role",
      })
      .clone();

    if (!foundedRoom) throw new Error("Room not found");

    await User.updateOne(
      { _id: newAdmin },
      {
        $addToSet: { enteredRooms: roomId },
        $pull: { pendingRoomsRequest: roomId },
      }
    ).clone();

    return foundedRoom;
  } catch (err: any) {
    Logging.log(err);
    throw err;
  }
};
const removeAnAdmin = async (user_id: string, room_id: string) => {
  try {
    const roomId = room_id as string;
    const userId = user_id as string;

    const foundedRoom = await Rooms.findRoomById(room_id);
    if (!foundedRoom) throw new Error("Room not found");

    await Rooms.updateOne(
      { _id: roomId },
      {
        $pull: { event_admin: userId },
      },
      { new: true }
    ).clone();

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const inviteAUser = async (room_id: string, inviteeId: string) => {
  try {
    const invitee_Id = inviteeId as string;
    const roomId = room_id as string;

    const foundedRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $addToSet: { event_invitees: invitee_Id },
      },
      { new: true }
    )
      .populate({
        path: "entered_id",
        model: "User",
        select:
          "-auth.password -role -profile.firstName -profile.lastName -refreshToken",
      })
      .clone();

    await User.updateOne(
      { _id: inviteeId },
      {
        $addToSet: { pendingRoomsRequest: roomId },
      }
    ).clone();

    return foundedRoom;
  } catch (err: any) {
    Logging.log(err);
    throw err;
  }
};
const unInviteAUser = async (inviteeId: string, room_id: string) => {
  try {
    const roomId = room_id as string;
    const userId = inviteeId as string;

    const foundedRoom = await Rooms.findRoomById(room_id);
    if (!foundedRoom) throw new Error("Room not found");

    const updatedRoom = await Rooms.updateOne(
      { _id: roomId },
      {
        $pull: {
          event_invitees: userId,
          event_admin: userId,
          entered_id: userId,
        },
      }
    )
      .populate({
        path: "entered_id",
        model: "User",
        select:
          "-auth.password -role -profile.firstName -profile.lastName -refreshToken",
      })
      .clone();

    await User.updateOne(
      { _id: inviteeId },
      {
        $pull: { pendingRoomsRequest: roomId, enteredRooms: roomId },
      }
    ).clone();

    return updatedRoom.modifiedCount;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const acceptRoomInvite = async (user_id: string, room_id: string) => {
  try {
    const userId = user_id as string;
    const roomId = room_id as string;

    const updatedRoom = await Rooms.updateMany(
      { _id: roomId },
      {
        $addToSet: { entered_id: userId },
        $pull: { event_invitees: userId, event_PendingRequests: userId },
      },
      (err: Error, doc: IRoomsDocument) => {
        Logging.info(doc);
        Logging.error(err);
        if (err) throw err;
      }
    ).clone();

    if (!updatedRoom) throw new Error(`Room did not accept user`);

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $addToSet: { enteredRooms: roomId },
        $pull: { pendingRoomsRequest: roomId },
      }
    ).clone();

    if (!updatedUser) throw new Error(`User entered rooms isn't updating`);

    return updatedUser.populate({ path: "enteredRooms", model: "Rooms" });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const roomsGetallPaginated = async (skip: number, limit: number) => {
  try {
    const foundedRoom = await Rooms.find({}).skip(skip).limit(limit);

    if (!foundedRoom) throw new Error("Room not found");

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const roomsNearByPaginated = async (
  user_id: string,
  lng: number,
  ltd: number,
  skip: number,
  limit: number
) => {
  try {
    const userId = user_id as string;

    const foundedUser = await User.findOne({ _id: userId }).clone();

    if (!foundedUser?.profile.location.radiusPreference) {
      throw new Error("radius preference is needed");
    }
    const radiusPrefMeters =
      foundedUser?.profile.location.radiusPreference * 1609.34;

    if (!foundedUser.profile.location.currentLocation)
      throw new Error("current location is needed");

    const nearbyRooms = await Rooms.find({
      event_location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, ltd],
          },
          $maxDistance: radiusPrefMeters,
        },
      },
    })
      .skip(skip)
      .limit(limit);

    return nearbyRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const roomsNearBy = async (user_id: string, lng: number, ltd: number) => {
  try {
    const userId = user_id as string;

    const foundedUser = await User.findOne({ _id: userId }).clone();

    if (!foundedUser?.profile.location.radiusPreference) {
      throw new Error("radius preference is needed");
    }
    const radiusPrefMeters =
      foundedUser?.profile.location.radiusPreference * 1609.34;

    if (!foundedUser.profile.location.currentLocation)
      throw new Error("current location is needed");

    const nearbyRooms = await Rooms.find({
      // Rooms that are no more than 4 weeks old
      event_schedule: {
        endDate: {
          $gte: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000,
        },
      },
      // Rooms that are not private
      event_privacy: {
        $ne: RoomPrivacy.private,
      },
      // Rooms that are near the user's current location
      event_location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, ltd],
          },
          $maxDistance: radiusPrefMeters,
        },
      },
    });

    return nearbyRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const incomingInvite = async (user_id: string, room_id: string) => {
  try {
    const userId = user_id as string;
    const roomId = room_id as string;

    const foundedRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $addToSet: { event_PendingRequests: userId },
      },
      { new: true }
    )
      .clone()
      .catch((err: any) => {
        Logging.error(err);
        throw err.message;
      });

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};
export const getIMG = async (id: string, fileType?: FileType) => {
  try {
    const _id = id as string;
    const foundRoom = await Rooms.findOne({ _id })
      .clone()
      .catch((err) => {
        throw err;
      });
    if (!foundRoom) throw new Error("user not found");

    if (fileType === FileType.flyer) {
      Logging.log(foundRoom.event_flyer_img.name);
      const imgUrl: string = await retrieveRoomIMG(
        foundRoom.event_flyer_img.name
      ).catch((err) => {
        Logging.error(err);
        throw err;
      });
      Logging.log(imgUrl);
      if (!imgUrl) throw new Error("Image not found");

      foundRoom.event_flyer_img.url = imgUrl;

      await foundRoom.save().catch((err: any) => {
        throw err.message;
      });

      return imgUrl;
    }

    if (fileType === FileType.media) {
      const mediaItems = (foundRoom.event_media_img || []).filter(
        (m: any) => typeof m?.name === "string" && m.name.length > 0
      );
      const updated = await Promise.all(
        mediaItems.map(async (media: IMGNames) => {
          const imgUrl = await retrieveRoomIMG(media.name).catch((err) => {
            Logging.error(err);
            throw err;
          });
          if (!imgUrl) throw new Error("Image not found");
          await Rooms.updateOne(
            { _id, "event_media_img.name": media.name },
            { $set: { "event_media_img.$.url": imgUrl } }
          ).catch((err: any) => {
            Logging.error(err);
            throw err;
          });
          return { name: media.name, url: imgUrl } as IMGNames;
        })
      );
      return updated;
    }

    if (fileType === FileType.venue) {
      const venueItems = (foundRoom.event_venue_image || []).filter(
        (m: any) => typeof m?.name === "string" && m.name.length > 0
      );
      const updated = await Promise.all(
        venueItems.map(async (media: IMGNames) => {
          const imgUrl = await retrieveRoomIMG(media.name).catch((err) => {
            Logging.error(err);
            throw err;
          });
          if (!imgUrl) throw new Error("Image not found");
          await Rooms.updateOne(
            { _id, "event_venue_image.name": media.name },
            { $set: { "event_venue_image.$.url": imgUrl } }
          ).catch((err: any) => {
            Logging.error(err);
            throw err;
          });
          return { name: media.name, url: imgUrl } as IMGNames;
        })
      );
      return updated;
    }

    if (fileType === FileType.venueVerification) {
      const imgUrl: string = await retrieveRoomIMG(
        foundRoom.venueVerification.name
      ).catch((err) => {
        Logging.error(err);
        throw err;
      });
      Logging.log(imgUrl);
      if (!imgUrl) throw new Error("Image not found");

      foundRoom.venueVerification.url = imgUrl;

      await foundRoom.save().catch((err: any) => {
        throw err.message;
      });

      return imgUrl;
    }
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};

export const addVenueVerificationIMG = async (
  room_Id: string,
  fileName: string
) => {
  try {
    const roomId = room_Id as string;
    const foundRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $set: {
          venueVerification: {
            name: fileName,
          },
        },
      }
    ).clone();

    return foundRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};

export const addFlyerIMG = async (room_Id: string, fileName: string) => {
  try {
    const roomId = room_Id as string;
    const foundRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $set: {
          event_flyer_img: {
            name: fileName,
          },
        },
      },
      { new: true }
    )
      .clone()
      .catch((err: any) => {
        throw err.message;
      });

    return foundRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};
export const addVenueImage = async (room_Id: string, fileName: string) => {
  try {
    const foundRoom = await getARoom(room_Id);
    if (!foundRoom) throw new Error("Room not found");

    foundRoom?.event_venue_image.push({ name: fileName, url: "" });

    await foundRoom?.save().catch((err: any) => {
      throw err.message;
    });

    return foundRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};
export const addMediaImage = async (room_Id: string, fileName: string) => {
  try {
    const foundRoom = await getARoom(room_Id);
    if (!foundRoom) throw new Error("Room not found");

    foundRoom?.event_media_img.push({ name: fileName, url: "" });

    await foundRoom?.save().catch((err: any) => {
      throw err.message;
    });

    return foundRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};

export {
  getARoom,
  getAllRooms,
  getRoomBy,
  createRoom,
  deleteRoom,
  updateRoom,
  addAnAdmin,
  inviteAUser,
  removeAnAdmin,
  unInviteAUser,
  acceptRoomInvite,
  roomsNearBy,
};
