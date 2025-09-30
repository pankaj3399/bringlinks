import User from "./user.model";
import bcryptUtil from "../../utils/bcrypt";
import {
  bookmarkType,
  IRoles,
  IUserDocument,
  IUserPreferences,
} from "./user.interface";
import jwt from "../../utils/authentication/jwt.createtoken";
import Logging from "../../library/logging";
import { Secret } from "jsonwebtoken";
import hashPass from "../../utils/hashPass";
import mongoose from "mongoose";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { deleteAviIMG, retrieveIMG } from "../../utils/ImageServices/user.Img";
import { checkImageUrl } from "../../utils/ImageServices/helperFunc.ts/checkImgUrlExpiration";

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

    const [newToken, freshToken]: Secret[] = jwt.CreateToken(
      foundUser._id.toString()
    );

    if (!newToken) throw new Error("Token is not created");
    if (!freshToken) throw new Error("Refresh token is not created");

    return { newToken, freshToken };
  } catch (err) {
    Logging.error(err);
    throw err; // Re-throw the error so the controller can handle it
  }
};
const registerUser = async (user: IUserDocument) => {
  try {
    const { auth } = user;

    const foundUser: IUserDocument = await User.findByUsername(auth.username);

    if (foundUser) {
      const msg = "the given username is already in use";
      throw new Error(msg);
    }

    const createdUser = await User.create(user);
    Logging.log(createdUser);
    if (!createdUser) throw new Error("Not registered");

    const [token, refreshToken]: Secret[] = jwt.CreateToken({
      _id: createdUser._id,
      role: IRoles.USER,
      username: user.auth.username,
      email: user.auth.email,
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
      .select("-auth.password -role -refreshToken")
      .clone()
      .exec();

    if (!userWithoutPassword) throw new Error("User not found");

    return [userWithoutPassword, token, refreshToken];
  } catch (err: any) {
    Logging.error(err.message);
    Logging.error(err.message);
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
      .select("-auth.password -role -refreshToken")
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
        ).select("-auth.password -role -refreshToken");

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
    ).select("-auth -role -refreshToken");

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
  user: Pick<IUserDocument, "auth">,
  sessionId: string
) => {
  try {
    Logging.log(user);
    const { username, password } = user.auth;
    const foundedUser = await User.findByUsername(username);
    if (!foundedUser) throw new Error("User is not found");

    hashPass(foundedUser, password);
    return foundedUser;
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
    }).select("-auth.password -role -refreshToken");

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
      select: "username",
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
      .select("-auth.password -role -refreshToken")
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
      },
      (err: any) => {
        Logging.error(err);
        if (err) throw err;
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
      select: "-password, role",
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
      select: "-auth.password, -role",
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
      .select("-auth.password, -role")
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
export const getIMG = async (id: string) => {
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
      throw new Error("User has no avatar set");
    }

    const imgUrl = await retrieveIMG(foundUser.profile.avi.aviName).catch(
      (err) => {
        throw err;
      }
    );

    if (!imgUrl) throw new Error("Image not found");

    foundUser.profile.avi.aviUrl = imgUrl;

    await foundUser.save().catch((err: any) => {
      throw err.message;
    });

    return foundUser.profile.avi.aviUrl;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};
export const deleteIMG = async (id: string) => {
  try {
    const _id = id as string;
    const foundUser = await User.findOne({ _id: _id }).clone();

    if (!foundUser) throw new Error("user not found");

    await deleteAviIMG(foundUser.profile.avi.aviName);

    const updatedUser = await User.updateOne({ _id: _id }, {
      $pull: {
        avi: {
          aviUrl: undefined,
          aviName: undefined,
        },
      },
    }).clone();

    return updatedUser.upsertedCount;
  } catch (err: any) {
    Logging.error(err.message);
    throw err.message;
  }
};

const getUserRecommendedRooms = async (userId: string) => {
  try {
    const recommendRooms = await User.aggregate([
      {
        $match: {
          _id: userId as string,
        },
      },
      {
        $graphLookup: {
          from: "User",
          startWith: { $setUnion: ["$following", "$followers"] },
          connectFromField: "following",
          connectToField: "_id",
          as: "network",
          maxDepth: 3,
        },
      },
      {
        $project: {
          _id: 1,
          networkUserIds: "$network._id",
        },
      },
      {
        $lookup: {
          from: "events",
          let: { networkIds: "$networkUserIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: {
                        $setIntersection: ["$attendees", "$$networkIds"],
                      },
                    },
                    0,
                  ],
                },
              },
            },
          ],
          as: "networkEvents",
        },
      },
      {
        $lookup: {
          from: "Rooms",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$userId", "$attendees"] },
              },
            },
          ],
          as: "userEvents",
        },
      },
      {
        $project: {
          networkEvents: 1,
          userEventIds: {
            $map: {
              input: "$userEvents",
              as: "event",
              in: "$$event._id",
            },
          },
        },
      },
      {
        $project: {
          recommendedEvents: {
            $filter: {
              input: "$networkEvents",
              as: "recommend",
              cond: {
                $not: { $in: ["$$recommend._id", "$userEventIds"] },
              },
            },
          },
        },
      },
      { $unwind: "$recommendedEvents" },
      { $replaceRoot: { newRoot: "$recommendedEvents" } },
    ]);

    return recommendRooms;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const getUserRecommendRooms = async (
  userId: string,
  filterByLocation = false
) => {
  try {
    const userObjectId = userId as string;

    // Get user’s current location and radius (in miles)
    const user = await User.findById(userObjectId, {
      "profile.location.currentLocation.coordinates": 1,
      "profile.location.radiusPreference": 1,
    }).lean();

    if (!user) throw new Error("User not found");

    const [lng, lat] =
      user?.profile?.location?.currentLocation?.coordinates || [];
    const radiusPreference = user?.profile?.location?.radiusPreference || 20;

    //const radiusInMeters = radiusInMiles * 1609.34; // miles to meters

    const now = new Date();

    const aggregation = [
      { $match: { _id: userObjectId } },

      {
        $graphLookup: {
          from: "User",
          startWith: { $setUnion: ["$following", "$followers"] },
          connectFromField: "following",
          connectToField: "_id",
          as: "network",
          maxDepth: 1,
        },
      },
      {
        $project: {
          _id: 1,
          networkUserIds: "$network._id",
        },
      },
      {
        $lookup: {
          from: "Rooms",
          let: { networkIds: "$networkUserIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $gt: [
                        {
                          $size: {
                            $setIntersection: ["$entered_id", "$$networkIds"],
                          },
                        },
                        0,
                      ],
                    },
                    { $gt: ["$event_schedule.endDate", Date.now()] },
                  ],
                },
              },
            },
            ...(filterByLocation && lat && lng
              ? [
                  {
                    $match: {
                      event_location: {
                        $nearSphere: {
                          $geometry: {
                            type: "Point",
                            coordinates: [lng, lat],
                          },
                          $maxDistance: radiusPreference,
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
          as: "networkRooms",
        },
      },
      {
        $lookup: {
          from: "rooms",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$userId", "$entered_id"] },
              },
            },
          ],
          as: "userRooms",
        },
      },
      {
        $project: {
          networkRooms: 1,
          userRoomIds: {
            $map: {
              input: "$userRooms",
              as: "room",
              in: "$$room._id",
            },
          },
        },
      },
      {
        $project: {
          recommendedRooms: {
            $filter: {
              input: "$networkRooms",
              as: "room",
              cond: {
                $not: { $in: ["$$room._id", "$userRoomIds"] },
              },
            },
          },
        },
      },
      { $unwind: "$recommendedRooms" },
      { $replaceRoot: { newRoot: "$recommendedRooms" } },
    ];

    const results = await User.aggregate(aggregation);
    return results;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

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
