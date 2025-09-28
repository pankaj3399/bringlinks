import Friend from "./friends.model";
import { IFriends } from "./friends.interface";
import mongoose from "mongoose";
import User from "../user.model";
var toId = mongoose.Types.ObjectId;

export const addFriend = async (user_Id: string, friend_Id: string) => {
  try {
    const userId = new toId(user_Id);
    const friendId = new toId(friend_Id);

    const foundedFriend = await Friend.findOne({ userId, friendId });

    if (foundedFriend) throw new Error("Already Friends");

    const createdFriend = await Friend.create({
      userId,
      friendId,
    });

    if (!createdFriend) throw new Error("Friend not created");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $addToSet: { friends: friendId },
      }
    ).clone();

    if (!updatedUser) throw new Error("User not updated");

    return foundedFriend;
  } catch (err) {
    throw err;
  }
};

export const unFriend = async (user_Id: string, friend_Id: string) => {
  try {
    const userId = new toId(user_Id);
    const friendId = new toId(friend_Id);

    const foundedFriend = await Friend.findOne({ userId, friendId });

    if (!foundedFriend) throw new Error("Friend not found");

    const updatedUser = await User.findByIdAndUpdate(
      { _id: userId },
      {
        $pull: { friends: friendId },
      }
    ).clone();

    if (!updatedUser) throw new Error("User not updated");

    return foundedFriend;
  } catch (err) {
    throw err;
  }
};

export const getFriends = async (friendId: string) => {
  try {
    const friendIdToFind = new toId(friendId);
    const foundedFriend = await Friend.findOne({ friendId: friendIdToFind });

    if (!foundedFriend) throw new Error("Friend not found");

    return foundedFriend.populate({
      path: "userId friendId",
      model: "User",
      select: "-auth -role",
    });
  } catch (err) {
    throw err;
  }
};
