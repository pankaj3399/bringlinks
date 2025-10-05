import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Posts from "../resources/post/post.model";
import User from "../resources/user/user.model";
import Comments from "../resources/comments/comments.model";
import Rooms from "../resources/room/room.model";
import Likes from "../resources/likes/likes.model";
import Logging from "../library/logging";
import { RoomPrivacy } from "../resources/room/room.interface";

//takes the id of the user making the request
// checks if that is the user making request account
export const isUserAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramUserId = String(req.params.userId);
    const authUserId = String(req.user?._id);
    if (paramUserId !== authUserId)
      return res.status(403).send({ message: "Must have valid user id" });
    const user_Id = authUserId as string;

    const foundUser = await User.find({ _id: user_Id })
      .clone()
      .exec();

    if (!foundUser)
      return res.status(403).send({ message: "Must be your account" });
    next();
  } catch (error: any) {
    Logging.error(error.message);
    throw error.message;
  }
};
//isUserPost - checks if the user making the post action is the request account
export const postPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userid, postid } = req.params;
    if (!userid || !postid) {
      return res.status(400).json({ message: "User ID and Post ID are required" });
    }
    const user_Id = userid as string;
    const post_Id = postid as string;
    const foundUserPost = await Posts.findOne({
      _id: post_Id,
      user_Id,
    }).clone();
    if (!foundUserPost)
      return res.status(401).json({ error: "Post is not user's post" });
    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};
// isUserComment
// checks if the user making the comment action is the request account
export const commentPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userid, postid, commentid } = req.params;
    if (!userid || !postid || !commentid) {
      return res.status(400).json({ message: "User ID, Post ID, and Comment ID are required" });
    }
    const user_Id = userid as string;
    const post_Id = postid as string;
    const comment_Id = commentid as string;

    // find the post Comment
    const foundPostComment = await Comments.findOne({
      _id: comment_Id,
      user_id: user_Id,
      post_Id,
    });

    if (!foundPostComment)
      return res.status(401).json({ error: "Comment is not user's comment" });

    next();
  } catch (error: any) {
    Logging.error(error.message);
    throw error;
  }
};

export const likePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userid, postid, likeid } = req.params;
    if (!userid || !postid || !likeid) {
      return res.status(400).json({ message: "User ID, Post ID, and Like ID are required" });
    }

    const user_Id = userid as string;
    const post_Id = postid as string;
    const like_Id = likeid as string;

    const foundUserPost = await Likes.findOne({
      _id: like_Id,
      user_Id: user_Id,
      posts: post_Id,
    });
    if (!foundUserPost)
      return res.status(401).json({ error: "Post not found" });

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};
//isRoomPrivateOrPublic
// checks if the room is private or public
export const isRoomPrivate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }
    const room_Id = roomId as string;
    const foundRoom = await Rooms.findOne({
      _id: room_Id,
      event_privacy: RoomPrivacy.private,
    }).clone();
    // If the room IS private, block access
    if (foundRoom)
      return res.status(401).json({ error: "This room is private" });

    // Not private → continue
    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};

//isInRoom
// checks if the req user making the action is in the room
export const enteredRoomPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, roomId } = req.params;
    if (!userId || !roomId) {
      return res.status(400).json({ message: "User ID and Room ID are required" });
    }

    const user_Id = userId as string;
    const room_Id = roomId as string;

    const foundUserRoom = await Rooms.findOne({
      _id: room_Id,
      entered_id: user_Id,
    }).clone();

    if (!foundUserRoom?.entered_id?.some((id: any) => id?.toString() === user_Id))
      return res
        .status(401)
        .json({ error: "Must be in the room to perform this action" });

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};

export const friendshipPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, friendId } = req.params;
    if (!userId || !friendId) {
      return res.status(400).json({ message: "User ID and Friend ID are required" });
    }
    const user_Id = userId as string;
    const friend_Id = friendId as string;

    const foundUser = await User.findOne({
      _id: user_Id,
      $or: [{ followers: friend_Id }, { following: friend_Id }],
    }).clone();

    const foundFriend = await User.findOne({
      _id: friend_Id,
      $or: [{ followers: friend_Id }, { following: friend_Id }],
    }).clone();

    if (!foundUser || !foundFriend)
      return res
        .status(401)
        .json({ error: "Must be friends to perform this action" });

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};
//isAdminRoom
// checks if the req user making the action is the admin to make changes
export const roomAdminPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, roomId } = req.params;
    if (!userId || !roomId) {
      return res.status(400).json({ message: "User ID and Room ID are required" });
    }
    const user_Id = userId as string;
    const room_Id = roomId as string;

    const foundRoom = await Rooms.findOne({
      _id: room_Id,
      event_admin: user_Id,
    }).clone();

    if (!foundRoom)
      return res
        .status(401)
        .json({ error: "This ID isn't an admin in this room" });

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};

export const isInvitedPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, roomId } = req.params;
    if (!userId || !roomId) {
      return res.status(400).json({ message: "User ID and Room ID are required" });
    }
    const user_Id = userId as string;
    const room_Id = roomId as string;

    //check if rooms have user in invitees if room is private
    const foundRoom = await Rooms.findOne(
      { _id: room_Id },
      { event_invitees: user_Id }
    ).clone();

    if (!foundRoom) {
      return res.status(401).json({ message: "This user is not in this room" });
    }

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};

//Given a userId, walletId making request is the wallet of that user
export const walletPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, walletId } = req.params;
    if (!userId || !walletId) {
      return res.status(400).json({ message: "User ID and Wallet ID are required" });
    }

    const user_Id = userId as string;
    const wallet_Id = walletId as string;

    const foundUser = await User.findOne({
      _id: user_Id,
      wallet: wallet_Id,
    }).exec();

    if (!foundUser) {
      return res.status(401).json({ message: "User wallet not found" });
    }

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};

export const creatorPermissions = async(
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user_Id = userId as string;
    const authUserId = String(req.user?._id);

    if (user_Id !== authUserId) {
      return res.status(403).json({ message: "Must have valid user id" });
    }

    const foundUser = await User.findOne({
      _id: user_Id,
      role: "CREATOR"
    }).clone();

    if (!foundUser) {
      return res.status(403).json({ 
        message: "User must be a creator to create paid rooms" 
      });
    }

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};