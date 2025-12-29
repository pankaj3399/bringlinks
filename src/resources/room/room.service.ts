import mongoose, { Error } from "mongoose";
import { GenderType, Race, Types } from "../../resources/user/user.interface";
import User from "../user/user.model";
import Logging from "../../library/logging";
import {
  IMGNames,
  IRoomsDocument,
  Pagination,
  RoomFilters,
  RoomPrivacy,
  SpecialGuestType,
  sponsorType,
} from "./room.interface";
import Rooms from "./room.model";
import { retrieveRoomIMG } from "../../utils/ImageServices/roomFlyer.Img";
import { FileType } from "../../utils/ImageServices/helperFunc.ts/room.Img";
import { IPaidRooms } from "./paidRooms/paidRoom.interface";
import QRCode from "qrcode";
import { validateEnv } from "../../../config/validateEnv";
import { createRegex } from "../../utils/ImageServices/helperFunc.ts/mongoose/partialRegex";
import { createARoomPost } from "../post/post.service";
import { getUserIMG } from "../user/user.service";
import { checkImageUrl } from "../../utils/ImageServices/helperFunc.ts/checkImgUrlExpiration";

const getARoom = async (id: string) => {
  try {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      Logging.warning(`Invalid room ID format: ${id}`);
      throw new Error("Invalid room ID format");
    }

    const foundedRoom = await Rooms.findById(id)
      .populate([
        {
          path: "created_user",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi followers",
        },
        {
          path: "shares",
          model: "Share",
          select: "platform shareType shareUrl analytics createdAt",
        },
        {
          path: "paidRoom",
          model: "PaidRooms",
          select: "_id tickets.pricing",
        },
      ])
      .lean()
      .exec();

    if (!foundedRoom) {
      Logging.warning(`Room not found with id: ${id}`);
      throw new Error("Room not found");
    }

    Logging.info(`Room found: ${id}`);
    return foundedRoom;
  } catch (err: any) {
    Logging.error(`Error in getARoom: ${err.message}`);
    throw new Error(err.message);
  }
};

export function buildFuzzyPattern(query: string): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fuzzy = escaped.split("").join(".?");
  return new RegExp(fuzzy, "i");
}

/**
 * Search users
 */
export async function searchUsers(pattern: RegExp, limit: number) {
  const users = await User.find(
    {
      $or: [
        { "auth.username": pattern },
        { "auth.email": pattern },
        { "profile.firstName": pattern },
        { "profile.lastName": pattern },
      ],
    },
    {
      "auth.username": 1,
      "profile.firstName": 1,
      "profile.lastName": 1,
      "profile.avi": 1,
    }
  )
    .limit(limit)
    .lean();

  //get users img
  await Promise.all(
    users.map(async (u) => {
      let userIMG;
      if (u.profile.avi) {
        userIMG = await getUserIMG(u._id.toString());
        u.profile.avi.aviUrl = userIMG;
      }
    })
  );

  return users.map((u: any) => ({
    _id: u._id,
    username: u.auth?.username || "",
    firstName: u.profile?.firstName || "",
    lastName: u.profile?.lastName || "",
    avi: u.profile?.avi || { aviUrl: "", aviName: "" },
  }));
}

/**
 * Search rooms
 */
export async function searchRooms(pattern: RegExp, limit: number) {
  const now = new Date();

  const rooms = await Rooms.find(
    {
      "event_schedule.endDate": { $gt: now },
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { event_name: pattern },
        { event_type: pattern },
        { event_typeOther: pattern },
        { event_description: pattern },
      ],
    },
    {
      event_name: 1,
      event_type: 1,
      event_typeOther: 1,
      event_description: 1,
      event_flyer_img: 1,
      event_schedule: 1,
      created_user: 1,
    }
  )
    .populate([
      {
        path: "created_user",
        model: "User",
        select:
          "auth.username profile.firstName profile.avi.aviUrl profile.avi.aviName",
      },
      {
        path: "paidRoom",
        model: "PaidRooms",
        select: "tickets.pricing",
      },
    ])
    .sort({ "event_schedule.startDate": 1 })
    .limit(limit)
    .lean();

  //get rooms img
  await Promise.all(
    rooms.map(async (r) => {
      let roomFlyerIMG;
      let creatorIMG;
      if (!r.event_flyer_img) roomFlyerIMG = "No Avatar";
      if (!(r.created_user as any).profile.avi) creatorIMG = "No Avatar";
      if ((r.created_user as any).profile.avi) {
        (r.created_user as any).profile.avi.aviUrl = creatorIMG;
      }
      roomFlyerIMG = await retrieveRoomIMG(r.event_flyer_img.name);
      r.event_flyer_img.url = roomFlyerIMG;
    })
  );

  return rooms.map((r: any) => ({
    _id: r._id,
    event_name: r.event_name,
    event_type: r.event_type,
    event_typeOther: r.event_typeOther,
    event_description: r.event_description,
    event_flyer_img: r.event_flyer_img,
    event_schedule: r.event_schedule,
    created_user: r.created_user
      ? {
          _id: r.created_user._id,
          username: r.created_user.auth?.username || "",
          firstName: r.created_user.profile?.firstName || "",
          avi: r.created_user.profile?.avi || { aviUrl: "", aviName: "" },
        }
      : null,
  }));
}

const getRoomBy = async (room: IRoomsDocument, path: string) => {
  const _id = room._id as string;

  try {
    const orConditions = [
      // Exact match for _id (IDs should be exact)
      _id ? { _id } : null,

      // Partial matches for text fields
      room.event_name ? { event_name: createRegex(room.event_name) } : null,
      room.event_type ? { event_type: createRegex(room.event_type) } : null,
      room.event_description
        ? { event_description: createRegex(room.event_description) }
        : null,
      room.event_typeOther
        ? { event_typeOther: createRegex(room.event_typeOther) }
        : null,

      // Partial matches for location fields
      room.event_location_address?.city
        ? {
            "event_location_address.city": createRegex(
              room.event_location_address.city
            ),
          }
        : null,
      room.event_location_address?.state
        ? {
            "event_location_address.state": createRegex(
              room.event_location_address.state
            ),
          }
        : null,
      room.event_location_address?.street_address
        ? {
            "event_location_address.street_address": createRegex(
              room.event_location_address.street_address
            ),
          }
        : null,
      room.event_location?.venue
        ? { "event_location.venue": createRegex(room.event_location.venue) }
        : null,

      // Exact match for numeric/ID fields
      room.entered_id ? { entered_id: room.entered_id } : null,

      // Date range queries (greater than or equal, less than or equal)
      room.event_schedule?.startDate
        ? {
            "event_schedule.startDate": { $gte: room.event_schedule.startDate },
          }
        : null,
      room.event_schedule?.endDate
        ? { "event_schedule.endDate": { $lte: room.event_schedule.endDate } }
        : null,
    ].filter(Boolean); // Remove null/undefined conditions

    if (orConditions.length === 0) {
      throw new Error("No valid search criteria provided");
    }

    const foundedRoom = await Rooms.find({
      $or: orConditions as any,
    })
      .clone()
      .populate([
        {
          path: path,
        },
        {
          path: "paidRoom",
          model: "PaidRooms",
          select: "tickets.pricing",
        },
      ]);

    Logging.log(foundedRoom);

    if (!foundedRoom || foundedRoom.length === 0) {
      throw new Error("Room not found");
    }

    return foundedRoom;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const getAllRooms = async () => {
  try {
    const allRooms = await Rooms.find().populate([
      { path: "created_user", model: "User" },
      {
        path: "shares",
        model: "Share",
        select: "platform shareType shareUrl analytics createdAt",
      },
      {
        path: "paidRoom",
        model: "PaidRooms",
        select: "_id tickets.pricing",
      },
    ]);

    if (!allRooms) throw new Error("Room not found");

    return allRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const getRoomDemographics = async (roomId: string) => {
  try {
    // Validate input
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      Logging.error("Invalid roomId provided to getRoomDemographics");
      throw new Error("Invalid room ID");
    }

    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    // Handle empty entered_id array
    if (
      !room.entered_id ||
      !Array.isArray(room.entered_id) ||
      room.entered_id.length === 0
    ) {
      return {
        totalEnteredUsers: 0,
        totalUsersWithData: 0,
        ageDistribution: {
          "18-25": 0,
          "26-35": 0,
          "36-45": 0,
          "46-55": 0,
          "56-65": 0,
          "65+": 0,
          unknown: 0,
        },
        genderDistribution: {
          Male: 0,
          Female: 0,
          Transgender: 0,
          NonBinary: 0,
          NoAnswer: 0,
          unknown: 0,
        },
        raceDistribution: {
          BLACK: 0,
          LATINO: 0,
          WHITE: 0,
          ASIAN: 0,
          "NATIVE AMERICAN": 0,
          "PACIFIC ISLANDER": 0,
          "TWO OR MORE": 0,
          NoAnswer: 0,
          unknown: 0,
        },
        occupationDistribution: {},
        roomInfo: {
          roomId: room._id || roomId,
          roomName: room.event_name || "Unknown Room",
          eventType: room.event_type || "Unknown Type",
        },
      };
    }

    // Get all entered users with their demographics
    let enteredUsers = await User.find({
      _id: { $in: room.entered_id },
    }).select("profile.demographic profile.occupation");

    // Initialize counters
    const ageGroups = {
      "18-25": 0,
      "26-35": 0,
      "36-45": 0,
      "46-55": 0,
      "56-65": 0,
      "65+": 0,
      unknown: 0,
    };

    const genderCount = {
      Male: 0,
      Female: 0,
      Transgender: 0,
      NonBinary: 0,
      NoAnswer: 0,
      unknown: 0,
    };

    const raceCount = {
      BLACK: 0,
      LATINO: 0,
      WHITE: 0,
      ASIAN: 0,
      "NATIVE AMERICAN": 0,
      "PACIFIC ISLANDER": 0,
      "TWO OR MORE": 0,
      NoAnswer: 0,
      unknown: 0,
    };

    const occupationCount: { [key: string]: number } = {};

    // Handle null/undefined enteredUsers
    if (!enteredUsers || !Array.isArray(enteredUsers)) {
      Logging.log("No entered users found for room demographics");
      enteredUsers = [];
    }

    // Process each user's demographics
    enteredUsers.forEach((user) => {
      // Skip null/undefined users
      if (!user) {
        Logging.log("Null user encountered in demographics processing");
        return;
      }

      const demographic = user.profile?.demographic;
      const occupation = user.profile?.occupation;

      // Age processing with validation
      try {
        if (demographic?.age !== null && demographic?.age !== undefined) {
          const age = Number(demographic.age);
          if (!isNaN(age) && age > 0 && age < 150) {
            // Reasonable age validation
            if (age >= 18 && age <= 25) ageGroups["18-25"]++;
            else if (age >= 26 && age <= 35) ageGroups["26-35"]++;
            else if (age >= 36 && age <= 45) ageGroups["36-45"]++;
            else if (age >= 46 && age <= 55) ageGroups["46-55"]++;
            else if (age >= 56 && age <= 65) ageGroups["56-65"]++;
            else if (age > 65) ageGroups["65+"]++;
            else ageGroups["unknown"]++;
          } else {
            ageGroups["unknown"]++;
          }
        } else {
          ageGroups["unknown"]++;
        }
      } catch (error) {
        Logging.error(`Error processing age for user: ${error}`);
        ageGroups["unknown"]++;
      }

      // Gender processing with validation
      try {
        if (demographic?.gender !== null && demographic?.gender !== undefined) {
          const genderValue = String(demographic.gender).trim();

          // Check if it's already a string (like "Male", "Female", etc.)
          if (genderValue in genderCount) {
            (genderCount as any)[genderValue]++;
          } else {
            // Try to parse as numeric index
            const genderIndex = Number(demographic.gender);
            if (!isNaN(genderIndex) && genderIndex >= 0) {
              const genderKeys = Object.keys(GenderType);
              if (genderIndex < genderKeys.length) {
                const genderKey = genderKeys[genderIndex];
                if (genderKey && genderKey in genderCount) {
                  (genderCount as any)[genderKey]++;
                } else {
                  genderCount["unknown"]++;
                }
              } else {
                genderCount["unknown"]++;
              }
            } else {
              genderCount["unknown"]++;
            }
          }
        } else {
          genderCount["unknown"]++;
        }
      } catch (error) {
        Logging.error(`Error processing gender for user: ${error}`);
        genderCount["unknown"]++;
      }

      // Race processing with validation
      try {
        if (demographic?.race !== null && demographic?.race !== undefined) {
          const raceValue = String(demographic.race).trim();

          // Check if it's already a string (like "BLACK", "WHITE", etc.)
          if (raceValue in raceCount) {
            (raceCount as any)[raceValue]++;
          } else {
            // Try to parse as numeric index
            const raceIndex = Number(demographic.race);
            if (!isNaN(raceIndex) && raceIndex >= 0) {
              const raceKeys = Object.keys(Race);
              if (raceIndex < raceKeys.length) {
                const raceKey = raceKeys[raceIndex];
                if (raceKey && raceKey in raceCount) {
                  (raceCount as any)[raceKey]++;
                } else {
                  raceCount["unknown"]++;
                }
              } else {
                raceCount["unknown"]++;
              }
            } else {
              raceCount["unknown"]++;
            }
          }
        } else {
          raceCount["unknown"]++;
        }
      } catch (error) {
        Logging.error(`Error processing race for user: ${error}`);
        raceCount["unknown"]++;
      }

      // Occupation processing with validation
      try {
        if (
          occupation &&
          typeof occupation === "string" &&
          occupation.trim() !== ""
        ) {
          const occupationKey = occupation.trim();
          if (occupationKey.length > 0 && occupationKey.length <= 100) {
            // Reasonable length check
            occupationCount[occupationKey] =
              (occupationCount[occupationKey] || 0) + 1;
          }
        }
      } catch (error) {
        Logging.error(`Error processing occupation for user: ${error}`);
      }
    });

    // Sort occupations by count (descending)
    const sortedOccupations = Object.entries(occupationCount)
      .sort(([, a], [, b]) => b - a)
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as { [key: string]: number });

    // Build demographics object with safe fallbacks
    const demographics = {
      totalEnteredUsers: room.entered_id?.length || 0,
      totalUsersWithData: enteredUsers?.length || 0,
      ageDistribution: ageGroups,
      genderDistribution: genderCount,
      raceDistribution: raceCount,
      occupationDistribution: sortedOccupations,
      roomInfo: {
        roomId: room._id || roomId,
        roomName: room.event_name || "Unknown Room",
        eventType: room.event_type || "Unknown Type",
      },
    };

    return demographics;
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
      const m = s.match(
        /^([0]?[1-9]|[1|2][0-9]|3[0|1])[./-]([0]?[1-9]|1[0-2])[./-]([0-9]{4}|[0-9]{2})$/
      );
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
        startDate: parseDdmmyyyy(
          (room as any).event_schedule?.startDate
        ) as any,
        endDate: parseDdmmyyyy((room as any).event_schedule?.endDate) as any,
      } as any,
    };

    // create a room
    const createdRoom = await Rooms.create(sanitized);
    if (!createdRoom) throw new Error("Room is not created");

    await Rooms.updateOne(
      { _id: createdRoom._id },
      {
        $set: { created_user: created_user },
        $addToSet: { entered_id: created_user, event_admin: created_user },
      }
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

    const updatedRoom = await Rooms.findById(createdRoom._id);
    if (!updatedRoom) throw new Error("Room not found after update");

    return await updatedRoom.populate({
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

    const roomUrl = `${validateEnv.FRONTEND_URL}/room/${roomId}`;

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
export const isEnteredRoom = async (userId: string, roomId: string) => {
  try {
    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    const enteredRoom = await Rooms.findOne({
      _id: roomId,
      entered_id: userId,
    });
    if (!enteredRoom) throw new Error("User is not entered");

    return true;
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

const createPurchaseQRCode = async (roomId: string, tierName: string) => {
  try {
    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    const purchaseUrl = `${
      validateEnv.FRONTEND_URL
    }/purchase/${roomId}?tier=${encodeURIComponent(tierName)}`;

    const qrCode = await QRCode.toDataURL(purchaseUrl);
    if (!qrCode) throw new Error("Purchase QR code not created");

    return qrCode;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const createEntryQRCode = async (
  roomId: string,
  userId: string,
  ticketId?: string
) => {
  try {
    const room = await Rooms.findById(roomId);
    if (!room) throw new Error("Room not found");

    const generatedTicketId = ticketId || `ticket_${Date.now()}`;
    const entryUrl = `${validateEnv.FRONTEND_URL}/entry/${roomId}?user=${userId}&ticket=${generatedTicketId}`;

    const qrCode = await QRCode.toDataURL(entryUrl);
    // Generate QR code image as PNG buffer and convert to base64 string
    let qrCodeImageBase64: string;

    const qrCodeBuffer = await QRCode.toBuffer(entryUrl, { type: "png" });
    qrCodeImageBase64 = qrCodeBuffer.toString("base64");

    if (!qrCode) throw new Error("Entry QR code not created");
    if (!qrCodeImageBase64) throw new Error("Entry QR code image not created");

    return [qrCode, qrCodeImageBase64];
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

    const orConditions: Record<string, any>[] = [];

    // Add conditions based on user preferences if they exist
    if (
      userPreferences?.favoriteTypesOfRooms &&
      userPreferences.favoriteTypesOfRooms.length > 0
    ) {
      userPreferences.favoriteTypesOfRooms.forEach((pref) => {
        if (pref.title) {
          orConditions.push(
            { event_typeOther: pref.title },
            { event_type: pref.title }
          );
        }
        if (pref.name) {
          orConditions.push({
            event_description: pref.name,
          });
        }
      });
    }

    if (
      userPreferences?.favoriteCityState &&
      userPreferences.favoriteCityState.length > 0
    ) {
      userPreferences.favoriteCityState.forEach((cityPref) => {
        if (cityPref.formatedAddress) {
          orConditions.push({
            "event_location_address.city_state": cityPref.formatedAddress,
          });
        }
      });
    }

    // If no conditions are available, return all rooms (fallback)
    const query = orConditions.length > 0 ? { $or: orConditions } : {};

    const foundedRooms = await Rooms.find(query).select(
      "-event_location_address -event_location "
    );

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

const updateRoom = async (room: Partial<IRoomsDocument>, room_id: string) => {
  try {
    const parseDdmmyyyy = (v?: unknown): Date | undefined => {
      if (!v) return undefined;
      const s = String(v).trim();
      // Accept DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
      const m = s.match(
        /^([0]?[1-9]|[1|2][0-9]|3[0|1])[./-]([0]?[1-9]|1[0-2])[./-]([0-9]{4}|[0-9]{2})$/
      );
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

    const updateData: Partial<IRoomsDocument> = { ...room };

    if (!room.event_typeOther) {
      updateData.event_typeOther = null;
    }

    // Parse date strings to Date objects if event_schedule is provided
    if (room.event_schedule) {
      updateData.event_schedule = {
        startDate: parseDdmmyyyy(
          (room as any).event_schedule?.startDate
        ) as any,
        endDate: parseDdmmyyyy((room as any).event_schedule?.endDate) as any,
      } as any;
    }

    const updatedRoom = await Rooms.findByIdAndUpdate(
      room_id,
      { $set: updateData },
      { new: true }
    )
      .lean()
      .populate({
        path: "created_user",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      });

    if (!updatedRoom) throw new Error("Room not found");

    return updatedRoom;
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
        select:
          "-auth.password -auth.email -role -refreshToken -wallet -signupCode -creator",
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
//invitation by a user to a room
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
          "-auth.password -auth.email -role -refreshToken -wallet -signupCode -creator",
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
          "-auth.password -auth.email -role -refreshToken -wallet -signupCode -creator",
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
export const joinRoom = async (user_id: string, room_id: string) => {
  try {
    const userId = user_id as string;
    const roomId = room_id as string;

    const updatedRoom = await Rooms.updateOne(
      { _id: roomId },
      {
        $addToSet: { entered_id: userId },
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

export const getAttendees = async (roomId: string) => {
  try {
    const roomIdString = roomId as string;
    const attendees = await Rooms.find({
      _id: roomIdString,
    }).populate([
      {
        path: "entered_id",
        model: "User",
        select: "_id auth.username profile.firstName profile.avi",
      },
    ]);
    if (!attendees) throw new Error("Attendees not found");
    return attendees;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const getAllUserEnteredRooms = async (userId: string) => {
  try {
    const userIdString = userId as string;

    const foundedUser = await User.findById(userIdString).select(
      "-auth.password -refreshToken"
    );
    if (!foundedUser) throw new Error("User not found");

    const enteredRooms = await Rooms.find({ entered_id: userIdString })
      .populate([
        {
          path: "created_user",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi",
        },
      ])
      .lean();

    if (!enteredRooms) throw new Error("Room not found");

    return enteredRooms;
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
      "event_schedule.startDate": {
        $gte: Date.now() - 24 * 60 * 60 * 1000,
      },

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
      .populate([
        {
          path: "created_user",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi",
        },
        {
          path: "paidRoom",
          model: "PaidRooms",
          select: "_id tickets.pricing",
        },
      ])
      .skip(skip)
      .limit(limit);

    return nearbyRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const getRoomsWithImages = async (rooms: IRoomsDocument[]) => {
  try {
    var foundPostMedia = [];
    const roomImages = await Promise.all(
      rooms.map(async (room, index) => {
        const roomImGName = room.event_flyer_img.name;
        if (!roomImGName) return foundPostMedia.push(room);
        const imageUrl = room.event_flyer_img.url;

        const isValid = checkImageUrl(imageUrl);
        if (!isValid) {
          const url = await retrieveRoomIMG(roomImGName);

          const updatedRoomFlyer = await Rooms.findByIdAndUpdate(
            { _id: room._id },
            {
              $set: {
                "event_flyer_img.url": url,
              },
            }
          );

          foundPostMedia.push(updatedRoomFlyer);
        } else {
          foundPostMedia.push(room);
        }

        return { ...room.toObject(), freshIMG: imageUrl };
      })
    );

    return roomImages;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const roomsNearBy = async (
  user_id: string,
  lng: number,
  ltd: number,
  radius: number | undefined = 35
) => {
  try {
    const userId = user_id as string;

    const foundedUser = await User.findOne({ _id: userId }).clone();

    if (!foundedUser?.profile.location.radiusPreference) {
      throw new Error("radius preference is needed");
    }
    const radiusPrefMeters = radius
      ? radius * 1609.34
      : foundedUser?.profile.location.radiusPreference * 1609.34;

    Logging.log(
      `Using coordinates from parameters: ${JSON.stringify(radiusPrefMeters)}`
    );
    if (!foundedUser.profile.location.currentLocation)
      throw new Error("current location is needed");

    const nearbyRooms = await Rooms.find({
      // Rooms event_schedule that are up coming up later than now - a day before
      "event_schedule.startDate": {
        $gte: Date.now() - 24 * 60 * 60 * 1000,
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
    }).populate([
      {
        path: "paidRoom",
        model: "PaidRooms",
        select: "tickets.pricing",
      },
      {
        path: "created_user",
        model: "User",
        select: "_id auth.username profile.firstName profile.avi",
      },
      {
        path: "shares",
        model: "Share",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);

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
export const getIMG = async (id: string, fileType?: Partial<FileType>) => {
  try {
    const _id = id as string;
    const foundRoom = await Rooms.findOne({ _id })
      .clone()
      .catch((err) => {
        throw err;
      });

    if (!foundRoom) throw new Error("user not found");
    Logging.log(`from getIMG for ${fileType}`);
    if (fileType === FileType.flyer) {
      Logging.log(`from getIMG for flyer ${foundRoom.event_flyer_img.name}`);
      const imgUrl: string = await retrieveRoomIMG(
        foundRoom.event_flyer_img.name
      ).catch((err) => {
        Logging.error(err);
        1;
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
      Logging.log(`Hitting media`);
      const mediaItems = (foundRoom.event_media_img || []).filter(
        (m: any) => typeof m?.name === "string" && m.name.length > 0
      );
      Logging.log(`mediaItems: ${JSON.stringify(mediaItems)}`);
      const updated = await Promise.all(
        mediaItems.map(async (media: IMGNames) => {
          Logging.log(`${media.name}`);
          const imgUrl = await retrieveRoomIMG(media.name).catch((err) => {
            Logging.error(err);
            throw err;
          });
          if (!imgUrl) throw new Error("Image not found");
          Logging.log(`imgUrl: ${imgUrl}`);
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
export const getCreatorIMG = async (roomId: string) => {
  try {
    const room = await Rooms.findById(roomId).populate({
      path: "created_user",
      model: "User",
      select: "_id profile.avi",
    });

    if (!room) throw new Error("Room not found");
    const creatorId = room?.created_user._id.toString();

    const imgUrl = await getUserIMG(creatorId).catch((err) => {
      Logging.error(err);
      throw err;
    });

    if (!imgUrl) throw new Error("Image not found");
    return imgUrl;
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
export const addMediaImage = async (
  room_Id: string,
  fileName: string,
  userId: string
) => {
  try {
    Logging.log(`addMediaImage: ${fileName}`);
    Logging.log(`room_Id: ${room_Id}`);
    Logging.log(`userId: ${userId}`);

    const foundRoom = await getARoom(room_Id);
    if (!foundRoom) throw new Error("Room not found");

    const updatedRoom = await Rooms.updateOne(
      {
        _id: room_Id,
      },
      { $addToSet: { event_media_img: { name: fileName, url: "" } } }
    );

    if (!updatedRoom) throw new Error("Room not updated");

    //create a post with media
    const createdPost = await createARoomPost(
      {
        content: {
          name: fileName,
          url: "",
        },
        postedLocation: {
          type: Types.Point,
          coordinates: foundRoom.event_location.coordinates,
        },
      },
      room_Id,
      userId
    );

    return updatedRoom;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};

export const roomsHrFromNow = async (
  userId: string,
  lng: number,
  ltd: number
) => {
  try {
    //this shows you rooms an hour from now
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000);

    const foundedUser = await User.findOne({ _id: userId })
      .select("-auth.password -role -refreshToken")
      .lean();

    if (!foundedUser) throw new Error("User not found");

    const radiusPrefMeters =
      foundedUser?.profile.location.radiusPreference * 1609.34;
    const nearbyRooms = await Rooms.find({
      // Rooms event_schedule that are up coming up later than now - a day before
      "event_schedule.startDate": {
        $gte: startDate,
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
    }).populate([
      {
        path: "paidRoom",
        model: "PaidRooms",
        select: "tickets.pricing",
      },
      {
        path: "created_user",
        model: "User",
        select: "_id auth.username profile.firstName profile.avi",
      },
      {
        path: "shares",
        model: "Share",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);

    return nearbyRooms;
  } catch (err: any) {
    Logging.error(`Error in getNearPost: ${err}`);
    throw err;
  }
};

export const getRooms35Miles = async (
  userId: string,
  lng: number,
  ltd: number,
  radius: number | undefined = 35
) => {
  try {
    const foundedUser = await User.findOne({ _id: userId })
      .select("-auth.password -role -refreshToken")
      .lean();

    if (!foundedUser) throw new Error("User not found");

    const nearbyRooms = await Rooms.find({
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
          $maxDistance: radius * 1609.34,
        },
      },
    });

    return nearbyRooms;
  } catch (err: any) {
    Logging.error(`Error in getNearPost: ${err}`);
    throw err;
  }
};
/**
 * Main filter function
 */
export async function filterRooms(
  filters: RoomFilters,
  pagination: Pagination
) {
  const { limit, page } = pagination;
  const skip = (page - 1) * limit;

  const query = buildQuery(filters);

  let rooms = await Rooms.find(query)
    .populate({
      path: "created_user",
      select: "auth.username profile.firstName profile.avi",
    })
    .populate({
      path: "paidRoom",
      select: "tickets.pricing",
    })
    .sort({ "event_schedule.startDate": 1 })
    .lean();

  // Apply time filter
  if (filters.timeStart || filters.timeEnd) {
    rooms = filterByTime(rooms, filters.timeStart, filters.timeEnd);
  }

  // Apply price filter
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    rooms = filterByPrice(
      rooms,
      filters.priceMin || 0,
      filters.priceMax || 120000
    );
  }

  const total = rooms.length;
  const paginatedRooms = rooms.slice(skip, skip + limit);

  return {
    rooms: formatRooms(paginatedRooms),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Build Mongoose query
 */
function buildQuery(filters: RoomFilters): any {
  const query: any = {
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  const startDate = filters.dateStart
    ? new Date(filters.dateStart)
    : new Date();
  const endDate = filters.dateEnd
    ? new Date(filters.dateEnd)
    : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);

  query["event_schedule.startDate"] = { $gte: startDate, $lte: endDate };

  if (filters.eventType) {
    const regex = new RegExp(filters.eventType, "i");
    query.$or = [{ event_type: regex }, { event_typeOther: regex }];
  }

  if (filters.miles && filters.lat && filters.lng) {
    const maxDistance = Math.min(filters.miles, 100) * 1609.34;

    query.event_location = {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [filters.lng, filters.lat],
        },
        $maxDistance: maxDistance,
      },
    };
  }

  return query;
}

/**
 * Filter rooms by time of day
 */
function filterByTime(
  rooms: any[],
  timeStart?: string,
  timeEnd?: string
): any[] {
  const startHour = timeStart ? parseInt(timeStart.split(":")[0]) : 0;
  const endHour = timeEnd ? parseInt(timeEnd.split(":")[0]) : 23;

  return rooms.filter((room) => {
    const eventHour = new Date(room.event_schedule.startDate).getHours();
    return eventHour >= startHour && eventHour <= endHour;
  });
}

/**
 * Filter rooms by price range
 */
function filterByPrice(
  rooms: any[],
  priceMin: number,
  priceMax: number
): any[] {
  return rooms.filter((room) => {
    const minPrice = getMinPrice(room.paidRoom);
    return minPrice >= priceMin && minPrice <= priceMax;
  });
}

/**
 * Get minimum price from paidRoom
 */
function getMinPrice(paidRoom: any): number {
  if (!paidRoom?.tickets?.pricing?.length) return 0;

  const prices = paidRoom.tickets.pricing.map((tier: any) => tier.price);
  return Math.min(...prices);
}

/**
 * Format rooms for response
 */
function formatRooms(rooms: any[]) {
  return rooms.map((r) => ({
    _id: r._id,
    event_name: r.event_name,
    event_type: r.event_type,
    event_typeOther: r.event_typeOther,
    event_description: r.event_description,
    event_flyer_img: r.event_flyer_img,
    event_schedule: r.event_schedule,
    event_location_address: r.event_location_address,
    paid: r.paid,
    minPrice: getMinPrice(r.paidRoom),
    pricing: r.paidRoom?.tickets?.pricing || [],
    created_user: r.created_user
      ? {
          _id: r.created_user._id,
          username: r.created_user.auth?.username || "",
          firstName: r.created_user.profile?.firstName || "",
          avi: r.created_user.profile?.avi || null,
        }
      : null,
  }));
}
export const getRoomAdminsByUserId = async (userId: string) => {
  try {
    const foundRooms = await Rooms.find({ event_admin: userId }).populate([
      {
        path: "event_admin",
        model: "User",
        select: "_id auth.username profile.firstName profile.avi",
      },
    ]);

    if (!foundRooms) throw new Error("Admins not found");
    // Add avatar images to each admin in each foundRoom and update profile.avi.aviUrl
    await Promise.all(
      foundRooms.map(async (room: any) => {
        if (!room.event_admin || !Array.isArray(room.event_admin)) return room;

        // Use Promise.all to resolve admin image URLs in parallel
        await Promise.all(
          room.event_admin.map(async (admin: any, idx: number) => {
            if (admin && admin._id) {
              try {
                const userImageUrl = await getUserIMG(admin._id.toString());
                // update the avi.aviUrl if avi exists, or create avi object if missing
                if (admin.profile && admin.profile.avi) {
                  admin.profile.avi.aviUrl = userImageUrl;
                } else if (admin.profile) {
                  admin.profile.avi = { aviUrl: userImageUrl };
                }
              } catch (err) {
                // If image not found, you can set avi.aviUrl as null or leave unchanged
                if (admin.profile && admin.profile.avi) {
                  admin.profile.avi.aviUrl = null;
                }
              }
            }
          })
        );
        return room;
      })
    );

    return foundRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};
export const getRoomAdmins = async (roomId: string) => {
  try {
    let admins: any[] = [];
    const room = await Rooms.findById(roomId).populate([
      {
        path: "event_admin",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      },
    ]);

    if (!room) throw new Error("Room not found");

    await Promise.all(
      room.event_admin.map(async (admin) => {
        const adminId = admin._id.toString();

        const adminUser = await User.findById(adminId);
        if (!adminUser) throw new Error("Admin not found");

        const userImage = await getUserIMG(adminUser._id.toString());
        Logging.log(`userImage: ${userImage}`);

        adminUser.profile.avi.aviUrl = userImage;
        adminUser.save();
        Logging.log(`adminUser: ${JSON.stringify(adminUser)}`);
        admins.push({
          _id: admin._id,
          username: adminUser.auth?.username || "",
          firstName: adminUser.profile?.firstName || "",
          avi: adminUser.profile?.avi || null,
        });
      })
    );

    return admins;
  } catch (err: any) {
    Logging.error(err);
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

export { createPurchaseQRCode, createEntryQRCode };
