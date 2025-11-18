import Friend from "./friends.model";

export const addFriend = async (user_Id: string, friend_Id: string) => {
  try {
    const userId = user_Id as string;
    const friendId = friend_Id as string;

    const foundedFriend = await Friend.findOne({ userId, friendId });

    if (foundedFriend) throw new Error("Already Friends");

    const createdFriend = await Friend.create({
      userId,
      friendId,
    });

    if (!createdFriend) throw new Error("Friend not created");

    return createdFriend;
  } catch (err: any) {
    throw err;
  }
};

export const removeFriend = async (user_Id: string, friend_Id: string) => {
  try {
    const userId = user_Id as string;
    const friendId = friend_Id as string;

    const foundedFriend = await Friend.findOne({ userId, friendId });

    if (!foundedFriend) throw new Error("Friend not found");

    const deletedFriend = await Friend.deleteOne({ userId, friendId });

    if (!deletedFriend) throw new Error("Friend not deleted");

    return deletedFriend;
  } catch (err: any) {
    throw err;
  }
};

export const findFriend = async (friendId: string) => {
  try {
    const friendIdToFind = friendId as string;

    const foundedFriend = await Friend.findOne({ friendId: friendIdToFind });

    if (!foundedFriend) throw new Error("Friend not found");

    return foundedFriend;
  } catch (err: any) {
    throw err;
  }
};
