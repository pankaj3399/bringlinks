import User from "./user.model";
import bcryptUtil from "../../utils/bcrypt";
import {
  bookmarkType,
  IRoles,
  IUserDocument,
  IUserPreferences,
  IUsers,
} from "./user.interface";
import jwt from "../../utils/authentication/jwt.createtoken";
import Logging from "../../library/logging";
import { Secret } from "jsonwebtoken";
import hashPass from "../../utils/hashPass";
import { deleteAviIMG, retrieveIMG } from "../../utils/ImageServices/user.Img";
import { checkImageUrl } from "../../utils/ImageServices/helperFunc.ts/checkImgUrlExpiration";
import { validateAndUseSignupCode } from "../signupCode/signupCode.service";
import { use } from "passport";
import { parseAllowedStates } from "../../utils/parseStates/allowedStates";
import mongoose from "mongoose";
import Rooms from "../room/room.model";
import { RoomTypes } from "../room/room.interface";

const getUserUsername = async (username: string) => {
  try {
    const foundUser = await User.findOne({ "auth.username": username }).select(
      "-auth.password, -role, -refreshToken"
    );
    if (!foundUser) throw new Error("User not found");

    return foundUser;
  } catch (err) {
    Logging.error(err);
  }
};
const getUserById = async (userId: string) => {
  try {
    const foundUser = await User.findById(userId).select(
      "-auth.password -role -refreshToken"
    );
    if (!foundUser) throw new Error("User not found");

    return foundUser;
  } catch (err) {
    Logging.error(err);
  }
};

const refreshTokenUser = async (token: string, userId: string) => {
  try {
    const foundUser = await User.findOne({ _id: userId });
    if (!foundUser) throw new Error("User not found");

    if (foundUser.refreshToken !== token) throw new Error("Invalid token");

    const [newToken, freshToken]: Secret[] = jwt.CreateToken({
      _id: foundUser._id,
      role: IRoles.USER,
      username: foundUser.auth.username,
      email: foundUser.auth.email,
    });

    if (!newToken) throw new Error("Token is not created");
    if (!freshToken) throw new Error("Refresh token is not created");
    Logging.log(`newToken ${newToken}`);
    Logging.log(`freshToken ${freshToken}`);
    const updatedUser = await User.findByIdAndUpdate(
      { _id: foundUser._id },
      {
        $set: {
          refreshToken: freshToken,
        },
      }
    )
      .select("-auth.password -role -refreshToken")
      .exec()
      .catch((err: any) => {
        Logging.error(err);
        throw err;
      });

    if (!updatedUser) throw new Error("User not found");

    return [newToken, freshToken];
  } catch (err) {
    Logging.error(err);
    throw err; // Re-throw the error so the controller can handle it
  }
};
export const requestPassword = async (userData: {
  auth: {
    email: string;
  };
}) => {
  try {
    const { email } = userData.auth;
    const user = await User.findOne({ "auth.email": email });
    if (!user) throw new Error("User not found");
    if (!user.auth.email) throw new Error("Email not found");

    if (user.auth.email !== email) throw new Error("Email not match");

    let refreshToken = user.refreshToken;
    if (!refreshToken) {
      const [, freshToken]: Secret[] = jwt.CreateToken({
        _id: user._id,
        role: IRoles.USER,
        username: user.auth.username,
        email: user.auth.email,
      });
      if (!freshToken) throw new Error("Failed to generate refresh token");

      await User.findByIdAndUpdate(
        { _id: user._id },
        { $set: { refreshToken: freshToken } }
      );
      refreshToken = freshToken;
    }

    // Send email to user
    const { default: EmailService } = await import(
      "../../utils/email/email.service"
    );
    await EmailService.sendPasswordRequestEmail(user.auth.email, refreshToken);

    return;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const registerUser = async (userData: Partial<IUsers>) => {
  try {
    // Signup code is required for all registrations
    if (!userData.signupCode) {
      throw new Error("Signup code is required for registration");
    }

    const allowedStates = parseAllowedStates();
    const isFromAllowedState = allowedStates.includes(
      (userData.state as string).trim().toLowerCase()
    );

    if (isFromAllowedState === false) {
      throw new Error("Registration not available in your state");
    }

    // Validate and use signup code
    const isValidCode = await validateAndUseSignupCode(userData.signupCode);
    if (!isValidCode) {
      throw new Error(
        "Invalid signup code or code has reached maximum usage limit"
      );
    }

    const foundUser: IUserDocument = await User.findByUsername(
      userData?.auth?.username as string
    ).catch((err) => {
      Logging.error(err);
      throw err;
    });
    if (foundUser) {
      throw new Error("The given username is already in use");
    }

    const foundEmail = await User.findOne({
      "auth.email": userData?.auth?.email as string,
    }).catch((err) => {
      Logging.error(err);
      throw err;
    });
    if (foundEmail) {
      throw new Error("The given email is already in use");
    }

    const userToCreate = {
      auth: userData.auth,
      profile: userData.profile,
      state: userData.state,
      signupCode: userData.signupCode,
      isVerified: true,
    };

    const createdUser = await User.create(userToCreate).catch((err) => {
      Logging.error(err);
      throw err;
    });

    Logging.log(`User created with signup code: ${createdUser._id}`);

    if (!createdUser) throw new Error("User registration failed");

    const [token, refreshToken]: Secret[] = jwt.CreateToken({
      _id: createdUser._id,
      role: IRoles.USER,
      username: createdUser.auth.username,
      email: createdUser.auth.email,
    });

    const createdUserId = createdUser._id as string;
    const userWithoutPassword = await User.findByIdAndUpdate(
      { _id: createdUserId },
      {
        $set: {
          refreshToken,
        },
      }
    )
      .select("-auth.password -role -refreshToken -signupCode")
      .clone()
      .exec();

    if (!userWithoutPassword) throw new Error("User not found");

    return [userWithoutPassword, token];
  } catch (err: any) {
    Logging.error(`Registration error: ${err.message}`);
    throw err.message;
  }
};
const loginUser = async (user: IUserDocument) => {
  try {
    const { username, password } = user.auth;

    Logging.log(` from service: ${JSON.stringify(user.auth)}`);
    const foundUser: IUserDocument = await User.findByUsername(username);
    if (!foundUser) {
      throw new Error("User is not found");
    }
    Logging.info(password);
    Logging.info(foundUser.auth.password);
    const checkedPassword: boolean = await bcryptUtil.compare(
      password,
      foundUser.auth.password
    );

    Logging.log(checkedPassword);
    if (!checkedPassword) {
      throw new Error("Invalid Password");
    }
    const [token, refreshToken]: Secret[] = jwt.CreateToken({
      _id: foundUser._id,
      role: IRoles.USER,
      username: foundUser.auth.username,
      email: foundUser.auth.email,
    });

    const userWithoutPassword = await User.findByIdAndUpdate(
      { _id: foundUser._id },
      {
        $set: {
          refreshToken,
        },
      },
      { new: true }
    )
      .select("-auth.password -role -refreshToken -signupCode")
      .exec();
    if (foundUser.profile.avi.aviUrl) {
      // check if aviUrl is valid
      const isValid = checkImageUrl(
        userWithoutPassword?.profile.avi.aviUrl as string
      );

      if (!isValid) {
        Logging.log("aviUrl is not valid");
        // get new url; from bucket
        const newUrl: string = await retrieveIMG(
          userWithoutPassword?.profile.avi.aviName as string
        );
        if (!newUrl) throw new Error("Image not found");

        const updatedUser = await User.findByIdAndUpdate(
          { _id: foundUser._id },
          {
            $set: {
              "profile.avi.aviUrl": newUrl,
            },
          },
          { new: true }
        ).select("-auth.password -role -refreshToken -signupCode");

        if (!updatedUser) throw new Error("User not updated");
        Logging.log(updatedUser.profile.avi.aviUrl);
        return [updatedUser, token, refreshToken];
      }
    }
    return [userWithoutPassword, token, refreshToken];
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const updateUserPreferences = async (
  _id: string,
  userPreferences: IUserPreferences
) => {
  try {
    Logging.log(`from update: \n ${JSON.stringify(userPreferences)}`);
    const userId = _id as string;
    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $set: {
          userPreferences,
        },
      }
    ).select("-auth -role -refreshToken -signupCode");

    if (!updatedUser) throw new Error("User not updated");
    return updatedUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const deleteUser = async (_id: string) => {
  try {
    const deletedUser = await User.findByIdAndDelete(
      { _id },
      {
        deletedAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      }
    );
    if (!deletedUser) throw Error("User not deleted");

    return deletedUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const updatePassword = async (
  password: string,
  _id: string
  //sessionId: string
) => {
  try {
    const foundedUser = await User.findById(_id);
    if (!foundedUser) throw new Error("User is not found");

    hashPass(foundedUser, password as string);
    return foundedUser.populate({
      path: "auth",
      model: "User",
      select: "-auth.password -role -refreshToken -signupCode",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const updateUser = async (
  user: Partial<IUserDocument>,
  userId: string
) => {
  try {
    const user_id = userId as string;
    const foundedUser = await User.findById(user_id);

    if (!foundedUser) throw new Error("User is not found");

    const updatedUser = await User.findByIdAndUpdate({ _id: user_id }, user, {
      new: true,
    }).select("-auth.password -role -refreshToken -signupCode");

    if (!updatedUser) throw new Error("User is not updated");

    return updatedUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const removeBookmark = async (
  userId: string,
  bookmark: bookmarkType
) => {
  try {
    const userIdToFind = userId as string;
    const foundUser = await User.findById(userIdToFind);
    if (!foundUser) throw new Error("User not found");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $pull: {
          profile: {
            bookmarks: bookmark,
          },
        },
      }
    ).clone();

    if (!updatedUser) throw new Error("User not updated");

    return updatedUser.profile.bookmarks;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const getUserBookmarks = async (userId: string) => {
  try {
    const userIdToFind = userId as string;
    const foundUser = await User.findById(userIdToFind);
    if (!foundUser) throw new Error("User not found");

    return foundUser.profile.bookmarks;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const addBookmark = async (userId: string, bookmark: bookmarkType) => {
  try {
    const userIdToFind = userId as string;
    const foundUser = await User.findById(userIdToFind);
    if (!foundUser) throw new Error("User not found");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $addToSet: {
          profile: {
            bookmarks: bookmark,
          },
        },
      }
    ).clone();

    if (!updatedUser) throw new Error("User not updated");

    return updatedUser.profile.bookmarks;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

const followerAUser = async (followee_id: string, user_id: string) => {
  try {
    const followeeId = followee_id as string;
    const userId = user_id as string;

    const foundUser = await User.findUserById(followee_id);
    if (!foundUser) throw new Error("User is not found");

    await User.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId },
          update: { $set: { followers: followeeId } },
        },
      },
      {
        updateOne: {
          filter: { _id: followeeId },
          update: { $set: { following: userId } },
        },
      },
    ]).catch((err: any) => {
      Logging.error(err);
      throw err;
    });

    return await foundUser.populate({
      path: "following",
      model: "User",
      select: "auth.username",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const getSchedule = async (user_Id: string) => {
  try {
    const userId = user_Id as string;
    const foundUser = await User.findById(userId)
      .select("-auth.password -role -refreshToken -signupCode")
      .exec();
    if (!foundUser) throw new Error("User not found");

    return foundUser.populate({
      path: "enteredRooms",
      model: "Rooms",
      select: "event_schedule",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const unfollowAUser = async (follower_id: string, user_id: string) => {
  try {
    const followeeId = follower_id as string;
    const userId = user_id as string;

    const foundUser = await User.findUserById(user_id);
    if (!foundUser) throw new Error("User is not found");

    await User.updateOne(
      { _id: followeeId },
      {
        $pull: { following: userId },
      }
    ).clone();

    const updatedUser = await User.updateOne(
      { _id: userId },
      {
        $pull: { followers: followeeId },
      }
    ).clone();
    return updatedUser.modifiedCount;
  } catch (err: any) {
    Logging.log(err);
    throw err;
  }
};
const findFollowers = async (user_id: string) => {
  try {
    const foundUser = await User.findUserById(user_id);
    if (!foundUser) throw new Error("user is not found");

    return await foundUser.populate({
      path: "followers",
      model: "User",
      select: "-auth.password, -role, -refreshToken, -signupCode",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const findFollowing = async (user_id: string) => {
  try {
    const foundUser = await User.findUserById(user_id);
    if (!foundUser) throw new Error("user is not found");

    return await foundUser.populate({
      path: "following",
      model: "User",
      select: "-auth.password, -role, -refreshToken, -signupCode",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};
export const clearRefreshToken = async (userId: string) => {
  try {
    const user_Id = userId as string;
    const foundUser = await User.findByIdAndUpdate(
      { _id: user_Id },
      {
        $set: {
          refreshToken: null,
        },
      }
    )
      .select("-auth.password, -role -refreshToken -signupCode")
      .exec()
      .catch((err: any) => {
        Logging.error(err);
        throw err;
      });
    Logging.info(foundUser);
    if (!foundUser) throw new Error("User not found");

    return foundUser;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
export const addAviIMG = async (user_Id: string, fileName: string) => {
  try {
    const userId = user_Id as string;
    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $set: {
          "profile.avi.aviName": fileName,
        },
      }
    ).clone();

    if (!updatedUser) throw new Error("User not updated");

    return true;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};
export const getUserIMG = async (id: string) => {
  try {
    const _id = id as string;
    const foundUser = await User.findOne({ _id: _id })
      .clone()
      .catch((err) => {
        throw err;
      });

    if (!foundUser) throw new Error("user not found");

    if (foundUser.profile.avi?.aviUrl) return foundUser.profile.avi.aviUrl;
    if (!foundUser.profile.avi?.aviName) {
      return "No Avatar";
    }

    const imgUrl = await retrieveIMG(foundUser.profile.avi.aviName).catch(
      (err) => {
        throw err;
      }
    );

    if (!imgUrl) throw new Error("Image not found");

    return imgUrl;
  } catch (err: any) {
    const msg = typeof err === "string" ? err : err?.message || "getIMG failed";
    Logging.error(`getIMG failed | message=${String(msg)}`);
    if (err?.stack) Logging.error(err.stack);
    throw new Error(msg);
  }
};
export const deleteIMG = async (id: string) => {
  try {
    const _id = id as string;
    const foundUser = await User.findOne({ _id }).lean();

    if (!foundUser) throw new Error("User not found");

    const aviName = foundUser?.profile?.avi?.aviName as string | undefined;
    if (!aviName || aviName.length === 0) throw new Error("Image not found");

    await deleteAviIMG(aviName);

    const updated = await User.updateOne(
      { _id },
      {
        $unset: {
          "profile.avi.aviUrl": "",
          "profile.avi.aviName": "",
        },
      }
    ).exec();

    return updated.modifiedCount > 0;
  } catch (err: any) {
    const msg = err?.message || err?.toString?.() || "Delete image failed";
    Logging.error(msg);
    throw new Error(msg);
  }
};

export const getUserRecommendRooms = async (
  userId: string,
  page: number,
  perPage: number,
  filterByLocation: boolean | undefined = false
) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(userObjectId, {
      "profile.location.currentLocation.coordinates": 1,
      "profile.location.radiusPreference": 1,
      following: 1,
      followers: 1,
      enteredRooms: 1,
      userPreferences: 1,
    }).lean();
    Logging.log(user);

    if (!user) throw new Error("User not found");

    const [lng, lat] =
      user?.profile?.location?.currentLocation?.coordinates || [];
    const radiusPreference = user?.profile?.location?.radiusPreference || 20;

    const now = new Date();
    const userEnteredRoomIds = (user.enteredRooms || []).map(
      (id: any) => new mongoose.Types.ObjectId(id)
    );

    const followingIds = (user.following || []).map(
      (id: any) => new mongoose.Types.ObjectId(id)
    );
    const followerIds = (user.followers || []).map(
      (id: any) => new mongoose.Types.ObjectId(id)
    );

    let networkUserIds = [
      ...new Set([
        ...followingIds.map((id) => id.toString()),
        ...followerIds.map((id) => id.toString()),
      ]),
    ].map((id) => new mongoose.Types.ObjectId(id));

    if (networkUserIds.length > 0) {
      const secondDegreeUsers = await User.find(
        { _id: { $in: networkUserIds } },
        { following: 1, followers: 1 }
      ).lean();

      let secondDegreeIds: mongoose.Types.ObjectId[] = [];
      for (const u of secondDegreeUsers) {
        if (u.following && Array.isArray(u.following)) {
          secondDegreeIds.push(
            ...u.following.map((id: any) => new mongoose.Types.ObjectId(id))
          );
        }
        if (u.followers && Array.isArray(u.followers)) {
          secondDegreeIds.push(
            ...u.followers.map((id: any) => new mongoose.Types.ObjectId(id))
          );
        }
      }

      const allNetworkIdsSet = new Set([
        ...networkUserIds.map((id) => id.toString()),
        ...secondDegreeIds.map((id) => id.toString()),
      ]);
      allNetworkIdsSet.delete(userObjectId.toString());
      networkUserIds = Array.from(allNetworkIdsSet).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }

    // Get event types from user's entered rooms
    const enteredRoomTypes = await getEnteredRoomEventTypes(userEnteredRoomIds);

    // Build preference-based search conditions
    const preferenceConditions = buildPreferenceConditions(
      user.userPreferences,
      enteredRoomTypes
    );

    const hasNetwork = networkUserIds.length > 0;
    const hasPreferences = preferenceConditions.length > 0;

    if (!hasNetwork && !hasPreferences) {
      Logging.info(
        `User ${userId} has no network and no preferences - returning empty`
      );
      return [];
    }

    const roomMatchConditions: any[] = [
      {
        "event_schedule.endDate": { $gt: now },
      },
      {
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
    ];

    const networkOrPreferenceConditions: any[] = [];

    if (hasNetwork) {
      networkOrPreferenceConditions.push({
        entered_id: { $in: networkUserIds },
      });
    }

    if (hasPreferences) {
      networkOrPreferenceConditions.push({
        $or: preferenceConditions,
      });
    }

    roomMatchConditions.push({
      $or: networkOrPreferenceConditions,
    });

    if (filterByLocation) {
      if (lat == null || lng == null) {
        throw new Error(
          "Latitude and longitude must be provided when filterByLocation is true."
        );
      }
      roomMatchConditions.push({
        event_location: {
          $nearSphere: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: radiusPreference * 1609.34,
          },
        },
      });
    }

    if (userEnteredRoomIds.length > 0) {
      roomMatchConditions.push({
        _id: { $nin: userEnteredRoomIds },
      });
    }

    const recommendedRooms = await Rooms.find({
      $and: roomMatchConditions,
    })
      .populate([
        {
          path: "created_user",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi",
        },
        {
          path: "event_admin",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi",
        },
      ])
      .lean()
      .sort({ "event_schedule.startDate": 1, "stats.score": -1 })
      .skip(page * perPage - perPage)
      .limit(perPage);

    Logging.info(
      `Found ${recommendedRooms.length} recommended rooms for user ${userId}`
    );

    return recommendedRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

/**
 * Fetches event_type and event_typeOther from user's entered rooms
 */
async function getEnteredRoomEventTypes(
  enteredRoomIds: mongoose.Types.ObjectId[]
): Promise<{ eventTypes: RoomTypes[]; eventTypeOthers: string[] }> {
  if (!enteredRoomIds.length) {
    return { eventTypes: [], eventTypeOthers: [] };
  }

  const enteredRooms = await Rooms.find(
    { _id: { $in: enteredRoomIds } },
    { event_type: 1, event_typeOther: 1 }
  ).lean();

  const eventTypes: RoomTypes[] = [];
  const eventTypeOthers: string[] = [];

  for (const room of enteredRooms) {
    if (room.event_type && !eventTypes.includes(room.event_type)) {
      eventTypes.push(room.event_type);
    }
    if (
      room.event_typeOther &&
      !eventTypeOthers.includes(room.event_typeOther)
    ) {
      eventTypeOthers.push(room.event_typeOther);
    }
  }

  return { eventTypes, eventTypeOthers };
}

/**
 * Builds MongoDB query conditions based on user preferences AND entered room history
 */
function buildPreferenceConditions(
  userPreferences?: IUserPreferences,
  enteredRoomTypes?: { eventTypes: RoomTypes[]; eventTypeOthers: string[] }
): any[] {
  const conditions: any[] = [];

  // From explicit user preferences
  if (userPreferences?.favoriteTypesOfRooms?.length) {
    for (const pref of userPreferences.favoriteTypesOfRooms) {
      if (pref.title) {
        conditions.push({ event_type: pref.title });
      }

      if (pref.name) {
        const escapedName = escapeRegex(pref.name);
        const regexPattern = new RegExp(escapedName, "i");

        conditions.push({ event_typeOther: regexPattern });
        conditions.push({ event_description: regexPattern });
      }
    }
  }

  // From entered rooms history
  if (enteredRoomTypes) {
    // Match rooms with same event_type as previously entered
    if (enteredRoomTypes.eventTypes.length > 0) {
      conditions.push({
        event_type: { $in: enteredRoomTypes.eventTypes },
      });
    }

    // Match rooms with similar event_typeOther (partial match)
    for (const otherType of enteredRoomTypes.eventTypeOthers) {
      if (otherType) {
        const escapedType = escapeRegex(otherType);
        const regexPattern = new RegExp(escapedType, "i");

        conditions.push({ event_typeOther: regexPattern });
        conditions.push({ event_description: regexPattern });
      }
    }
  }

  return conditions;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export {
  getUserUsername,
  getUserById,
  registerUser,
  loginUser,
  deleteUser,
  updatePassword,
  followerAUser,
  findFollowing,
  findFollowers,
  unfollowAUser,
  refreshTokenUser,
  getSchedule,
};
