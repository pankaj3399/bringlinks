import mongoose, { model } from "mongoose";
import Logging from "../../library/logging";
import {
  ChatTypes,
  IChatsDocument,
  ICreateGroupRequest,
  IUpdateGroupRequest,
  IMessageRequest,
  IGroup,
} from "./chats.interface";
import Chats, { GroupModel } from "./chats.model";
import User from "../../resources/user/user.model";
import Rooms from "../../resources/room/room.model";
import { getMediaSignedUrl } from "../../utils/ImageServices/mediaUpload";
import { retrieveIMG } from "../../utils/ImageServices/user.Img";
import { retrieveRoomIMG } from "../../utils/ImageServices/roomFlyer.Img";

export const createMessage = async ({
  sender,
  message,
  receiver,
  group,
  room_Id,
  chatType,
}: IChatsDocument): Promise<IChatsDocument | null> => {
  try {
    const newMessage = new Chats({
      sender,
      chatType,
      receiver,
      group,
      room_Id,
      message,
    });

    if (chatType === ChatTypes.group) {
      const groupDoc = new GroupModel({
        members: [sender, receiver],
        chat_Id: newMessage._id,
      });
      // Save the group document
      await groupDoc.save();
      await newMessage.save();

      // Update the group document with the new message ID
      await Chats.updateOne(
        { _id: newMessage._id },
        { $set: { group: groupDoc._id } }
      );
      return newMessage;
    } else if (chatType === ChatTypes.room) {
      // Save the room document
      const savedRoom = await Rooms.findByIdAndUpdate(
        { _id: newMessage.room_Id },
        {
          $push: {
            chats: newMessage._id,
          },
        }
      );
      if (!savedRoom) {
        throw new Error("Room message is not saved");
      }
    } else if (chatType === ChatTypes.user) {
      // Save the user document
      const savedUser = await User.findByIdAndUpdate(
        { _id: receiver },
        {
          $push: {
            chats: newMessage._id,
          },
        }
      );
      if (!savedUser) {
        throw new Error("User message is not saved");
      }
    }

    await newMessage.save();
    return newMessage;
  } catch (error) {
    return null;
  }
};

// --- User-to-User Chats ---
export const findAllUserToUserChats = async (userId: string) => {
  const chats: any[] = [];
  // Get all user-to-user chats involving this user
  const allUserToUserChats = await Chats.find({
    chatType: ChatTypes.user,
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .sort({ timestamps: -1 })
    .lean();

  // Build up conversations: map[sorted-participants_key] = latestMessage
  const convoMap: { [key: string]: any } = {};

  for (const chat of allUserToUserChats) {
    const participants = [String(chat.sender), String(chat.receiver)].sort();
    const key = participants.join("_");

    // Only store latest message per user-to-user conversation
    if (
      !convoMap[key] ||
      new Date(chat.timestamps).getTime() >
        new Date(convoMap[key].timestamps).getTime()
    ) {
      convoMap[key] = chat;
    }
  }

  const userToUserChats = Object.values(convoMap);

  // Attach relevant user info and images
  for (const chat of userToUserChats) {
    const otherUserId =
      String(chat.sender) === userId ? chat.receiver : chat.sender;
    let otherUser = null;
    try {
      otherUser = await User.findById(otherUserId)
        .lean()
        .select("auth.username profile.firstName profile.avi");
    } catch {}
    const chatWithImages: any = { ...chat };
    if (otherUser) {
      chatWithImages.receiver = {
        _id: otherUser._id,
        auth: { username: otherUser.auth.username },
        profile: {
          firstName: otherUser.profile?.firstName,
          avi: {
            aviName: otherUser.profile?.avi?.aviName || null,
            aviUrl: otherUser.profile?.avi?.aviUrl || null,
          },
        },
      };
    }
    // Optionally attach images
    if (otherUser?.profile?.avi?.aviName) {
      try {
        chatWithImages.receiverIMG = await retrieveIMG(
          otherUser.profile.avi.aviName
        );
      } catch (error) {
        Logging.error(`Error retrieving receiver image: ${error}`);
      }
    }
    // Sender image
    let senderUserDoc: any = null;
    try {
      senderUserDoc = await User.findById(chat.sender)
        .lean()
        .select("profile.avi");
    } catch {}
    if (senderUserDoc?.profile?.avi?.aviName) {
      try {
        chatWithImages.senderIMG = await retrieveIMG(
          senderUserDoc.profile.avi.aviName
        );
      } catch (error) {
        Logging.error(`Error retrieving sender image: ${error}`);
      }
    }

    chats.push(chatWithImages);
  }

  return chats;
};

// --- Group Chats ---
// Returns for each group the latest chat plus the three most recent users (with their images) who sent a message in that group
export const findAllGroupChats = async (userId: string) => {
  const result: any[] = [];
  // Find all group IDs where user is a member/admin/creator
  const userGroups = await GroupModel.find({
    isActive: true,
    $or: [{ members: userId }, { admins: userId }, { createdBy: userId }],
  }).select("_id");

  const groupIds = userGroups.map((g: any) => g._id);

  if (groupIds.length > 0) {
    // Find the latest chat for each group
    const latestChats = await Chats.aggregate([
      {
        $match: {
          chatType: ChatTypes.group,
          group: { $in: groupIds },
        },
      },
      { $sort: { timestamps: -1 } },
      {
        $group: {
          _id: "$group",
          latestChat: { $first: "$$ROOT" },
        },
      },
    ]);

    for (const entry of latestChats) {
      const chat = entry.latestChat;

      // Attach groupInfo
      let groupInfo = null;
      try {
        groupInfo = await GroupModel.findById(chat.group).lean();
      } catch {}

      // Attach sender info for latest chat
      let senderInfo = null;
      try {
        senderInfo = await User.findById(chat.sender)
          .lean()
          .select("auth.username profile.firstName profile.avi");
      } catch {}

      // Find the 3 most recent unique users who sent a message, excluding possible duplicates
      // Exclude users without a profile if necessary
      const recentSendersDocs = await Chats.aggregate([
        {
          $match: {
            chatType: ChatTypes.group,
            group: chat.group,
          },
        },
        { $sort: { timestamps: -1 } },
        // group by sender, first is most recent
        {
          $group: {
            _id: "$sender",
            message: { $first: "$$ROOT" },
            timestamps: { $first: "$timestamps" },
          },
        },
        { $limit: 3 },
      ]);

      // Get user IDs
      const userIds = recentSendersDocs.map((doc) => doc._id);

      // Fetch user profiles and avatars for those 3 senders
      const users = await User.find({ _id: { $in: userIds } })
        .select("auth.username profile.firstName profile.avi")
        .lean();

      // Build user image results
      const recentSenders: any[] = [];
      for (const u of users) {
        const userObj = {
          _id: u._id,
          auth: { username: u.auth.username },
          profile: {
            firstName: u.profile?.firstName,
            avi: {
              aviName: u.profile?.avi?.aviName || null,
              aviUrl: u.profile?.avi?.aviUrl || null,
            },
          },
        };
        // Attach avatar image url as 'userIMG' if available
        if (u.profile?.avi?.aviName) {
          try {
            userObj.profile.avi.aviUrl = await retrieveIMG(
              u.profile.avi.aviName
            );
          } catch (error) {
            Logging.error(`Error retrieving sender image: ${error}`);
          }
        }
        recentSenders.push(userObj);
      }

      const chatWithImages: any = { ...chat };

      // Attach group object
      if (groupInfo) {
        chatWithImages.group = {
          _id: groupInfo._id,
          name: groupInfo.name,
          description: groupInfo.description,
        };
      }
      if (senderInfo) {
        chatWithImages.senderInfo = {
          _id: senderInfo._id,
          auth: { username: senderInfo.auth.username },
          profile: {
            firstName: senderInfo.profile?.firstName,
            avi: {
              aviName: senderInfo.profile?.avi?.aviName || null,
              aviUrl: senderInfo.profile?.avi?.aviUrl || null,
            },
          },
        };
        if (senderInfo.profile?.avi?.aviName) {
          try {
            chatWithImages.senderIMG = await retrieveIMG(
              senderInfo.profile.avi.aviName
            );
          } catch (error) {
            Logging.error(`Error retrieving sender image: ${error}`);
          }
        }
      }

      // Attach top 3 recent senders with their images
      chatWithImages.recentSenders = recentSenders;
      result.push(chatWithImages);
    }
  }
  return result;
};

// --- Room Inbox Chats ---
// Returns latest chat per room the user has entered (i.e., their "inbox" for rooms)
export const findAllRoomChats = async (userId: string) => {
  const chats: any[] = [];

  // Only consider rooms the user has already ENTERED
  const enteredRooms = await Rooms.find({
    entered_id: userId,
  }).select("_id");

  Logging.log(enteredRooms);
  const roomIds = enteredRooms.map((r: any) => r._id);

  if (roomIds.length > 0) {
    // Find latest chat for each entered room
    // Get all chats in those rooms sorted by latest first
    const roomLatestMap: { [key: string]: any } = {};
    const allRoomChats = await Chats.find({
      chatType: ChatTypes.room,
      room_Id: { $in: roomIds },
    })
      .sort({ timestamps: -1 })
      .lean();
    Logging.log(allRoomChats);
    // For each chat, keep only the most recent per room
    for (const chat of allRoomChats) {
      const roomIdStr = String(chat.room_Id);
      if (!roomLatestMap[roomIdStr]) {
        roomLatestMap[roomIdStr] = chat;
      }
    }

    // Collect and decorate the inbox entries
    for (const chat of Object.values(roomLatestMap)) {
      // Attach room info
      let roomInfo = null;
      try {
        roomInfo = await Rooms.findById(chat.room_Id).lean();
      } catch (error) {
        Logging.error(`Error retrieving room info: ${error}`);
      }
      //check if roomInfo.event_flyer_img.url is valid
      if (roomInfo?.event_flyer_img?.url) {
        roomInfo.event_flyer_img.url = await retrieveRoomIMG(
          roomInfo.event_flyer_img.name
        );
      }

      const chatWithImages: any = { ...chat };
      if (roomInfo) {
        chatWithImages.room_Id = {
          _id: roomInfo._id,
          event_name: roomInfo.event_name,
          event_type: roomInfo.event_type,
        };
        // Only return the room flyer image
        chatWithImages.roomFlyerIMG = roomInfo.event_flyer_img || null;
      }
      chats.push(chatWithImages);
    }
  }
  return chats;
};

// --- Unified Entry Point ---
export const findAllUserChats = async (user_id: string, chatType?: string) => {
  try {
    const userId = user_id as string;
    let chats: any[] = [];
    const foundedUser = await User.findById(userId)
      .lean()
      .select(
        "-auth.password -role -refreshToken -pendingRoomsRequest -enteredRooms"
      );
    if (!foundedUser) throw new Error("User not found");
    Logging.log(chatType);

    if (!chatType || chatType === ChatTypes.user || chatType === "all") {
      const userChats = await findAllUserToUserChats(userId);
      chats = chats.concat(userChats);
    }
    if (!chatType || chatType === ChatTypes.group || chatType === "all") {
      const groupChats = await findAllGroupChats(userId);
      chats = chats.concat(groupChats);
    }
    if (!chatType || chatType === ChatTypes.room || chatType === "all") {
      const roomChats = await findAllRoomChats(userId);
      chats = chats.concat(roomChats);
    }

    // Sort all chats by timestamp
    chats.sort((a, b) => {
      const timeA = new Date(a.timestamps).getTime();
      const timeB = new Date(b.timestamps).getTime();
      return timeB - timeA;
    });

    return chats;
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};

export const getChatHistory = async (
  chatType: ChatTypes,
  targetId: string,
  userId?: string,
  page: number = 1,
  limit: number = 25
): Promise<IChatsDocument[]> => {
  try {
    let query;
    if (chatType === ChatTypes.user) {
      // Fetch user-to-user chat history
      query = {
        chatType: "userToUser",
        $or: [
          { sender: userId, receiver: targetId },
          { sender: targetId, receiver: userId },
        ],
      };
    } else if (chatType === ChatTypes.group) {
      // Fetch group chat history
      query = { chatType: ChatTypes.group, group: targetId };
    } else {
      // Fetch room chat history
      query = { chatType: ChatTypes.room, room_Id: targetId };
    }

    const messages = await Chats.find(query)
      .sort("timestamp")
      .skip((page - 1) * limit)
      .limit(limit + 1);

    // map through messages and the sender avatar image
    const messagesWithSenderAvatar: any[] = await Promise.all(
      messages.map(async (message) => {
        const sender = await User.findById(message.sender).select(
          "profile.avi"
        );

        if (sender?.profile?.avi?.aviName) {
          sender.profile.avi.aviUrl = await retrieveIMG(
            sender.profile.avi.aviName
          );
        }

        return {
          ...message,
          senderAvatar: sender?.profile?.avi?.aviUrl,
        };
      })
    );

    return messagesWithSenderAvatar;
  } catch (error) {
    Logging.error(`Error fetching chat history: ${error}`);
    return [];
  }
};

export const createAChat = async (chat: IChatsDocument) => {
  try {
    const createdChat = await Chats.create(chat);
    if (!createdChat) throw new Error(`Chat isn't created`);

    return (
      await createdChat.populate({ path: "user_id", model: "User" })
    ).populate({ path: "room_id", model: "Rooms" });
  } catch (err: any) {
    Logging.error(err);
  }
};
export const findAllChat = async () => {
  try {
    const allChat = await Chats.find({});
    if (!allChat) throw new Error(`Chat isn't found`);

    return allChat;
  } catch (err: any) {
    Logging.error(err);
  }
};
export const chatById = async (id: string) => {
  try {
    const chatId = id as string;
    const foundChat = await Chats.findOne({ _id: chatId });
    if (!foundChat) throw new Error(`Chat isn't found`);

    return (
      await foundChat.populate({ path: "user_Id", model: "User" })
    ).populate({ path: "room_Id", model: "Rooms" });
  } catch (err: any) {
    Logging.error(err);
  }
};
export const findUserChats = async (user_id: string, chat_id: string) => {
  try {
    const userId = user_id as string;
    const chatId = chat_id as string;

    const userChat = await Chats.findOne({ _id: chatId, user_Id: userId });
    if (!userChat) throw new Error(`Chat isn't found`);

    return userChat;
  } catch (err: any) {
    Logging.error(err);
  }
};
export const findRoomChat = async (room_id: string, chat_id: string) => {
  try {
    const roomId = room_id as string;
    const chatId = chat_id as string;

    const roomChat = await Chats.findOne({ _id: chatId, user_Id: roomId });
    if (!roomChat) throw new Error(`Chat isn't found`);

    return roomChat;
  } catch (err: any) {
    Logging.error(err);
  }
};

export const createGroup = async (
  groupData: ICreateGroupRequest
): Promise<IGroup | null> => {
  try {
    const { name, description, members, createdBy } = groupData;

    if (!mongoose.Types.ObjectId.isValid(createdBy)) {
      throw new Error("Invalid creator ID format");
    }

    for (const memberId of members) {
      if (!mongoose.Types.ObjectId.isValid(memberId)) {
        throw new Error(`Invalid member ID format: ${memberId}`);
      }
    }

    const memberIds = members.map((id) => new mongoose.Types.ObjectId(id));
    const existingUsers = await User.find({ _id: { $in: memberIds } });

    if (existingUsers.length !== memberIds.length) {
      throw new Error("One or more members do not exist");
    }

    const newGroup = new GroupModel({
      name,
      description,
      members: memberIds,
      admins: [new mongoose.Types.ObjectId(createdBy)],
      createdBy: new mongoose.Types.ObjectId(createdBy),
      isActive: true,
    });

    await newGroup.save();
    Logging.info(`Group created successfully: ${newGroup._id}`);
    return newGroup;
  } catch (error) {
    Logging.error(`Error creating group: ${error}`);
    return null;
  }
};

export const updateGroup = async (
  updateData: IUpdateGroupRequest
): Promise<IGroup | null> => {
  try {
    const { groupId, name, description, members, admins } = updateData;

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (members) {
      const memberIds = members.map((id) => new mongoose.Types.ObjectId(id));
      updateFields.members = memberIds;
    }
    if (admins) {
      const adminIds = admins.map((id) => new mongoose.Types.ObjectId(id));
      updateFields.admins = adminIds;
    }

    const updatedGroup = await GroupModel.findByIdAndUpdate(
      groupId,
      updateFields,
      { new: true }
    );

    if (!updatedGroup) {
      throw new Error("Group not found");
    }

    Logging.info(`Group updated successfully: ${groupId}`);
    return updatedGroup;
  } catch (error) {
    Logging.error(`Error updating group: ${error}`);
    return null;
  }
};

export const getGroupById = async (groupId: string): Promise<IGroup | null> => {
  try {
    const group = await GroupModel.findById(groupId).populate([
      {
        path: "event_admin",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      },
      {
        path: "members",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      },
      {
        path: "admins",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      },
      {
        path: "createdBy",
        model: "User",
        select: "auth.username profile.firstName profile.avi",
      },
    ]);

    return group;
  } catch (error) {
    Logging.error(`Error fetching group: ${error}`);
    return null;
  }
};

export const getUserGroups = async (userId: string): Promise<IGroup[]> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const groups = await GroupModel.find({
      isActive: true,
      $or: [
        { members: userObjectId },
        { admins: userObjectId },
        { createdBy: userObjectId },
      ],
    })
      .populate([
        {
          path: "members",
          model: "User",
          select: "auth.username profile.firstName profile.avi",
        },
        {
          path: "admins",
          model: "User",
          select: "auth.username profile.firstName profile.avi",
        },
        {
          path: "createdBy",
          model: "User",
          select: "auth.username profile.firstName profile.avi",
        },
      ])
      .sort({ updatedAt: -1 });

    return groups;
  } catch (error) {
    Logging.error(`Error fetching user groups: ${error}`);
    return [];
  }
};

export const addMemberToGroup = async (
  groupId: string,
  userId: string
): Promise<boolean> => {
  try {
    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    if (
      !group.members.some(
        (member) => member.toString() === userIdObj.toString()
      )
    ) {
      group.members.push(userIdObj);
      await group.save();
    }

    Logging.info(`Member added to group: ${userId} -> ${groupId}`);
    return true;
  } catch (error) {
    Logging.error(`Error adding member to group: ${error}`);
    return false;
  }
};

export const removeMemberFromGroup = async (
  groupId: string,
  userId: string
): Promise<boolean> => {
  try {
    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    group.members = group.members.filter(
      (member) => member.toString() !== userIdObj.toString()
    );
    group.admins = group.admins.filter(
      (admin) => admin.toString() !== userIdObj.toString()
    );

    await group.save();
    Logging.info(`Member removed from group: ${userId} -> ${groupId}`);
    return true;
  } catch (error) {
    Logging.error(`Error removing member from group: ${error}`);
    return false;
  }
};

export const createMessageWithMedia = async (
  messageData: IMessageRequest
): Promise<IChatsDocument | null> => {
  try {
    const {
      sender,
      receiver,
      groupId,
      roomId,
      message,
      chatType,
      media,
      replyTo,
    } = messageData;

    if (!mongoose.Types.ObjectId.isValid(sender)) {
      throw new Error("Invalid sender ID format");
    }

    const newMessage = new Chats({
      sender: new mongoose.Types.ObjectId(sender),
      chatType,
      message,
      media,
      replyTo:
        replyTo && mongoose.Types.ObjectId.isValid(replyTo)
          ? new mongoose.Types.ObjectId(replyTo)
          : undefined,
    });

    if (chatType === ChatTypes.user && receiver) {
      if (!mongoose.Types.ObjectId.isValid(receiver)) {
        throw new Error("Invalid receiver ID format");
      }
      newMessage.receiver = new mongoose.Types.ObjectId(receiver);
    } else if (chatType === ChatTypes.group && groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new Error("Invalid group ID format");
      }
      newMessage.group = new mongoose.Types.ObjectId(groupId);
    } else if (chatType === ChatTypes.room && roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        throw new Error("Invalid room ID format");
      }
      newMessage.room_Id = new mongoose.Types.ObjectId(roomId);
    }

    await newMessage.save();

    if (chatType === ChatTypes.group && groupId) {
      await GroupModel.findByIdAndUpdate(groupId, {
        $set: { chat_Id: newMessage._id },
      });
    } else if (chatType === ChatTypes.room && roomId) {
      await Rooms.findByIdAndUpdate(roomId, {
        $push: { chats: newMessage._id },
      });
    } else if (chatType === ChatTypes.user && receiver) {
      await User.findByIdAndUpdate(receiver, {
        $push: { chats: newMessage._id },
      });
    }

    Logging.info(`Message created successfully: ${newMessage._id}`);
    return newMessage;
  } catch (error) {
    Logging.error(`Error creating message: ${error}`);
    return null;
  }
};

export const editMessage = async (
  messageId: string,
  newMessage: string,
  userId: string
): Promise<IChatsDocument | null> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new Error("Invalid message ID format");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID format");
    }

    const message = await Chats.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (
      message.sender.toString() !==
      new mongoose.Types.ObjectId(userId).toString()
    ) {
      throw new Error("Unauthorized to edit this message");
    }

    message.message = newMessage;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    Logging.info(`Message edited successfully: ${messageId}`);
    return message;
  } catch (error) {
    Logging.error(`Error editing message: ${error}`);
    return null;
  }
};

export const deleteMessage = async (
  messageId: string,
  userId: string
): Promise<boolean> => {
  try {
    Logging.log(`messageId in deleteMessage: ${messageId}`);
    Logging.log(`userId in deleteMessage: ${userId}`);
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new Error("Invalid message ID format");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID format");
    }

    const message = await Chats.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (
      message.sender.toString() !==
      new mongoose.Types.ObjectId(userId).toString()
    ) {
      throw new Error("Unauthorized to delete this message");
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.message = "This message was deleted";

    await message.save();
    Logging.info(`Message deleted successfully: ${messageId}`);
    return true;
  } catch (error) {
    Logging.error(`Error deleting message: ${error}`);
    return false;
  }
};

export const getChatHistoryWithMedia = async (
  chatType: ChatTypes,
  targetId: string,
  userId?: string,
  page: number = 1,
  limit: number = 50
): Promise<{ messages: IChatsDocument[]; hasMore: boolean }> => {
  try {
    let query;
    if (chatType === ChatTypes.user) {
      query = {
        chatType: "userToUser",
        $or: [
          { sender: userId, receiver: targetId },
          { sender: targetId, receiver: userId },
        ],
        isDeleted: false,
      };
    } else if (chatType === ChatTypes.group) {
      query = {
        chatType: ChatTypes.group,
        group: targetId,
        isDeleted: false,
      };
    } else {
      query = {
        chatType: ChatTypes.room,
        room_Id: targetId,
        isDeleted: false,
      };
    }

    const skip = (page - 1) * limit;
    const messages = await Chats.find(query)
      .populate("sender", "name email profilePicture profile.avi")
      .populate("replyTo", "message sender")
      .sort({ timestamps: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    await Promise.all(
      resultMessages.map(async (message) => {
        // Handle media URLs
        if (message.media) {
          try {
            if (!message.media.url.startsWith("https://")) {
              message.media.url = await getMediaSignedUrl(message.media.url);
            }
          } catch (error) {
            Logging.error(
              `Error generating signed URL for message ${message._id}: ${error}`
            );
          }
        }

        // Retrieve sender image
        const sender = message.sender as any;
        if (sender?.profile?.avi?.aviName) {
          try {
            const senderImgUrl = await retrieveIMG(sender.profile.avi.aviName);
            (message as any).sender.profile.avi.aviUrl = senderImgUrl;
          } catch (error) {
            Logging.error(
              `Error retrieving sender image for message ${message._id}: ${error}`
            );
          }
        }
      })
    );

    return {
      messages: resultMessages.reverse(),
      hasMore,
    };
  } catch (error) {
    Logging.error(`Error fetching chat history: ${error}`);
    return { messages: [], hasMore: false };
  }
};
