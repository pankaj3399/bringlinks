import mongoose from "mongoose";
import Logging from "../../library/logging";
import { ChatTypes, IChatsDocument, ICreateGroupRequest, IUpdateGroupRequest, IMessageRequest, IGroup } from "./chats.interface";
import Chats, { GroupModel } from "./chats.model";
import User from "../../resources/user/user.model";
import Rooms from "../../resources/room/room.model";
import { getMediaSignedUrl } from "../../utils/ImageServices/mediaUpload";

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

export const getChatHistory = async (
  chatType: ChatTypes,
  targetId: string,
  userId?: string
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

    const messages = await Chats.find(query).sort("timestamp");
    return messages;
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

export const createGroup = async(groupData: ICreateGroupRequest): Promise<IGroup | null> =>{
  try {
    const { name, description, members, createdBy } = groupData;
    
    if (!mongoose.Types.ObjectId.isValid(createdBy)) {
      throw new Error("Invalid creator ID format");
    }
    
    for (const memberId of members){
      if (!mongoose.Types.ObjectId.isValid(memberId)){
        throw new Error(`Invalid member ID format: ${memberId}`);
      }
    }
    
    const memberIds = members.map(id => new mongoose.Types.ObjectId(id));
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

export const updateGroup = async (updateData: IUpdateGroupRequest): Promise<IGroup |null> =>{
  try {
    const { groupId, name, description, members, admins } = updateData;
    
    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (members) {
      const memberIds = members.map(id => new mongoose.Types.ObjectId(id));
      updateFields.members = memberIds;
    }
    if (admins) {
      const adminIds = admins.map(id => new mongoose.Types.ObjectId(id));
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

export const getGroupById = async (groupId: string): Promise<IGroup | null> =>{
  try {
    const group = await GroupModel.findById(groupId)
      .populate('members', 'name email profilePicture')
      .populate('admins', 'name email profilePicture')
      .populate('createdBy', 'name email profilePicture');
    
    return group;
  } catch (error) {
    Logging.error(`Error fetching group: ${error}`);
    return null;
  }
};

export const getUserGroups = async (userId: string): Promise<IGroup[]> =>{
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
      .populate('members', 'name email profilePicture')
      .populate('admins', 'name email profilePicture')
      .populate('createdBy', 'name email profilePicture')
      .sort({ updatedAt: -1 });

    return groups;
  } catch (error) {
    Logging.error(`Error fetching user groups: ${error}`);
    return [];
  }
};

export const addMemberToGroup = async (groupId: string, userId: string): Promise<boolean> => {
  try {
    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    if (!group.members.some(member => member.toString() === userIdObj.toString())) {
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

export const removeMemberFromGroup = async (groupId: string, userId: string): Promise<boolean> =>{
  try {
    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    group.members = group.members.filter(member => member.toString() !== userIdObj.toString());
    group.admins = group.admins.filter(admin => admin.toString() !== userIdObj.toString());
    
    await group.save();
    Logging.info(`Member removed from group: ${userId} -> ${groupId}`);
    return true;
  } catch (error) {
    Logging.error(`Error removing member from group: ${error}`);
    return false;
  }
};

export const createMessageWithMedia = async (messageData: IMessageRequest): Promise<IChatsDocument | null> => {
  try {
    const { sender, receiver, groupId, roomId, message, chatType, media, replyTo } = messageData;

    if (!mongoose.Types.ObjectId.isValid(sender)) {
      throw new Error("Invalid sender ID format");
    }

    const newMessage = new Chats({
      sender: new mongoose.Types.ObjectId(sender),
      chatType,
      message,
      media,
      replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? new mongoose.Types.ObjectId(replyTo) : undefined,
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
        $set: { chat_Id: newMessage._id }
      });
    } else if (chatType === ChatTypes.room && roomId) {
      await Rooms.findByIdAndUpdate(roomId, {
        $push: { chats: newMessage._id }
      });
    } else if (chatType === ChatTypes.user && receiver) {
      await User.findByIdAndUpdate(receiver, {
        $push: { chats: newMessage._id }
      });
    }

    Logging.info(`Message created successfully: ${newMessage._id}`);
    return newMessage;
  } catch (error) {
    Logging.error(`Error creating message: ${error}`);
    return null;
  }
};

export const editMessage = async (messageId: string, newMessage: string, userId: string): Promise<IChatsDocument | null> => {
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

    if (message.sender.toString() !== new mongoose.Types.ObjectId(userId).toString()) {
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

export const deleteMessage = async (messageId: string, userId: string): Promise<boolean> => {
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

    if (message.sender.toString() !== new mongoose.Types.ObjectId(userId).toString()) {
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
): Promise<{ messages: IChatsDocument[], hasMore: boolean }> => {
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
      .populate('sender', 'name email profilePicture')
      .populate('replyTo', 'message sender')
      .sort({ timestamps: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    for (const message of resultMessages) {
      if (message.media) {
        try {
          if (!message.media.url.startsWith('https://')) {
            message.media.url = await getMediaSignedUrl(message.media.url);
          }
        } catch (error) {
          Logging.error(`Error generating signed URL for message ${message._id}: ${error}`);
        }
      }
    }

    return {
      messages: resultMessages.reverse(), 
      hasMore
    };
  } catch (error) {
    Logging.error(`Error fetching chat history: ${error}`);
    return { messages: [], hasMore: false };
  }
};
