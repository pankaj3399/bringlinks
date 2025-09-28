import mongoose from "mongoose";
import Logging from "../../library/logging";
import { ChatTypes, IChatsDocument } from "./chats.interface";
import Chats, { GroupModel } from "./chats.model";
import User from "../../resources/user/user.model";
import Rooms from "../../resources/room/room.model";
var toId = mongoose.Types.ObjectId;

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
    console.error("Error creating message:", error);
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
    const chatId = new toId(id);
    const foundChat = await Chats.findOne(chatId);
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
    const userId = new toId(user_id);
    const chatId = new toId(chat_id);

    const userChat = await Chats.findOne({ _id: chatId, user_Id: userId });
    if (!userChat) throw new Error(`Chat isn't found`);

    return userChat;
  } catch (err: any) {
    Logging.error(err);
  }
};
export const findRoomChat = async (room_id: string, chat_id: string) => {
  try {
    const roomId = new toId(room_id);
    const chatId = new toId(chat_id);

    const roomChat = await Chats.findOne({ _id: chatId, user_Id: roomId });
    if (!roomChat) throw new Error(`Chat isn't found`);

    return roomChat;
  } catch (err: any) {
    Logging.error(err);
  }
};
