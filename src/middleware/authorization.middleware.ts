import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Posts from "../resources/post/post.model";
import User from "../resources/user/user.model";
import Comments from "../resources/comments/comments.model";
import Rooms from "../resources/room/room.model";
import Likes from "../resources/likes/likes.model";
import Logging from "../library/logging";
import { RoomPrivacy } from "../resources/room/room.interface";
var toId = mongoose.Types.ObjectId;

//takes the id of the user making the request
// checks if that is the user making request account
export const isUserAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.params.userId !== req.user?._id)
      return res.status(403).send({ message: "Must have valid user id" });
    const user_Id = new toId(req.user?._id);

    const foundUser = await User.find({ _id: { $eq: user_Id } })
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
    if (!userid || postid) res.status(400).send("Id is required");
    const user_Id = new toId(userid);
    const post_Id = new toId(postid);
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
    if (!userid || !postid || !commentid)
      res.status(400).send("Id is required");
    const user_Id = new toId(userid);
    const post_Id = new toId(postid);
    const comment_Id = new toId(commentid);

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
    if (!userid || postid || likeid) res.status(400).send("Id is required");

    const user_Id = new toId(userid);
    const post_Id = new toId(postid);
    const like_Id = new toId(likeid);

    const foundUserPost = await Likes.findOne({
      _id: like_Id,
      likedUser_Id: user_Id,
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
    if (!roomId) res.status(400).send("Id is required");
    const room_Id = new toId(roomId);
    const foundRoom = await Rooms.findOne({
      _id: room_Id,
      event_privacy: RoomPrivacy.private,
    }).clone();
    if (!foundRoom)
      return res.status(401).json({ error: "This room is private" });

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
    if (!userId || !roomId) res.status(400).send("Id is required");

    const user_Id = new toId(userId);
    const room_Id = new toId(roomId);

    const foundUserRoom = await Rooms.findOne({
      _id: room_Id,
      entered_id: user_Id,
    }).clone();

    if (!foundUserRoom?.entered_id.includes(user_Id))
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
    if (!userId || !friendId) res.status(400).send("Id is required");
    const user_Id = new toId(userId);
    const friend_Id = new toId(friendId);

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
    if (!userId || !roomId) res.status(400).send("Id is required");
    const user_Id = new toId(userId);
    const room_Id = new toId(roomId);

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
    if (!userId || !roomId) res.status(400).send("Id is required");
    const user_Id = new toId(userId);
    const room_Id = new toId(roomId);

    //check if rooms have user in invitees if room is private
    const foundRoom = await Rooms.findOne(
      { _id: room_Id },
      { event_invitees: user_Id }
    ).clone();

    if (!foundRoom) res.status(401).send("This id isn't a User in this Room");

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
    if (!userId || !walletId) res.status(400).send("Id is required");

    const user_Id = new toId(userId);
    const wallet_Id = new toId(walletId);

    const foundUser = await User.findOne({
      _id: user_Id,
      wallet: wallet_Id,
    }).exec();

    if (!foundUser) res.status(401).send("User wallet not found");

    next();
  } catch (error: any) {
    Logging.error(error);
    throw error;
  }
};
