import { Request, Response, NextFunction, Router } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import {
  findRoomChat,
  findUserChats,
  getChatHistory,
  createGroup,
  updateGroup,
  getGroupById,
  getUserGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  createMessageWithMedia,
  editMessage,
  deleteMessage,
  getChatHistoryWithMedia,
} from "./chats.service";
import {
  ChatTypes,
  IMessageRequest,
  ICreateGroupRequest,
  IUpdateGroupRequest,
} from "./chats.interface";
import { RequiredAuth } from "../../middleware/auth.middleware";
import {
  createGroupValidation,
  updateGroupValidation,
  addMemberValidation,
  removeMemberValidation,
  editMessageValidation,
  deleteMessageValidation,
  getChatHistoryValidation,
} from "./chats.validation";
import {
  uploadMediaFile,
  getMediaTypeFromMimeType,
  validateMediaFile,
  MediaType,
} from "../../utils/ImageServices/mediaUpload";

class ChatController implements Controller {
  public path = "/chat";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/history/:chatType/:targetId`,
      RequiredAuth,
      this.getChatHistoryWithMedia
    );

    this.router.post(`${this.path}/group`, RequiredAuth, this.createGroup);
    this.router.get(`${this.path}/group/:groupId`, RequiredAuth, this.getGroup);
    this.router.get(
      `${this.path}/groups/user/:userId`,
      RequiredAuth,
      this.getUserGroups
    );
    this.router.put(
      `${this.path}/group/:groupId`,
      RequiredAuth,
      this.updateGroup
    );
    this.router.post(
      `${this.path}/group/:groupId/member`,
      RequiredAuth,
      this.addMember
    );
    this.router.delete(
      `${this.path}/group/:groupId/member/:userId`,
      RequiredAuth,
      this.removeMember
    );

    this.router.get(
      `${this.path}/:chatid/:userId/:chatType`,
      RequiredAuth,
      this.getChatHistory
    );
    this.router.get(
      `${this.path}/:userId/:chatid`,
      RequiredAuth,
      this.userChats
    );
    this.router.get(
      `${this.path}/:roomId/:chatid`,
      RequiredAuth,
      this.roomChats
    );
    this.router.post(`${this.path}/message`, RequiredAuth, this.sendMessage);
    this.router.put(
      `${this.path}/message/:messageId`,
      RequiredAuth,
      this.editMessage
    );
    this.router.delete(
      `${this.path}/message/:messageId`,
      RequiredAuth,
      this.deleteMessage
    );

    this.router.post(
      `${this.path}/upload-media`,
      RequiredAuth,
      this.uploadMedia
    );
  }
  private getChatHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { chatid, chatType } = req.params;
      if (!chatid) throw new Error("Id is required");
      if (!req.user?._id) throw new Error("Unauthorized");
      const userId = req.user._id as string;
      const chatHistory = await getChatHistory(
        chatType as ChatTypes,
        chatid,
        userId
      );
      if (!chatHistory) throw new Error("Chat is not found");
      res.status(200).json(chatHistory);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(400, err.message);
    }
  };
  private userChats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { chatid, userId } = req.params;
      if (!chatid || !userId) throw new Error("Id is required");

      const usersChat = await findUserChats(userId, chatid);
      if (!usersChat) throw new Error("Chat is not found");

      res.status(200).json(usersChat);
    } catch (err: any) {
      next(new HttpException(400, err));
    }
  };
  private roomChats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { chatid, roomId } = req.params;
      if (!chatid || !roomId) throw new Error("Id is required");

      const roomsChat = await findRoomChat(roomId, chatid);
      if (!roomsChat) throw new Error("Chat is not found");

      res.status(200).json(roomsChat);
    } catch (err: any) {
      next(new HttpException(400, err));
    }
  };

  private getChatHistoryWithMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { chatType, targetId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      if (!req.user?._id) throw new Error("Unauthorized");
      const userId = req.user._id as string;

      const validation = getChatHistoryValidation.validate({
        chatType,
        targetId,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const result = await getChatHistoryWithMedia(
        chatType as ChatTypes,
        targetId,
        userId,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(result);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { receiver, groupId, roomId, message, chatType, replyTo } =
        req.body;
      if (!req.user?._id) throw new Error("Unauthorized");
      const sender = req.user._id as string;

      const messageData: IMessageRequest = {
        sender,
        receiver,
        groupId,
        roomId,
        message,
        chatType,
        replyTo,
      };

      const newMessage = await createMessageWithMedia(messageData);
      if (!newMessage) throw new Error("Failed to create message");

      res.status(201).json(newMessage);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private editMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { messageId } = req.params;
      const { message } = req.body;
      if (!req.user?._id) throw new Error("Unauthorized");
      const userId = req.user._id as string;

      const validation = editMessageValidation.validate({ messageId, message });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const updatedMessage = await editMessage(messageId, message, userId);
      if (!updatedMessage) throw new Error("Failed to edit message");

      res.status(200).json(updatedMessage);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private deleteMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { messageId } = req.params;
      if (!req.user?._id) throw new Error("Unauthorized");
      const userId = req.user._id as string;

      const validation = deleteMessageValidation.validate({ messageId });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const success = await deleteMessage(messageId, userId);
      if (!success) throw new Error("Failed to delete message");

      res.status(200).json({ message: "Message deleted successfully" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private uploadMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.files || !req.files.media) {
        throw new Error("No media file provided");
      }

      const mediaFile = req.files.media as any;
      if (!req.user?._id) throw new Error("Unauthorized");
      const userId = req.user._id as string;

      validateMediaFile(mediaFile);

      const mediaType = getMediaTypeFromMimeType(mediaFile.mimetype);

      const mediaMessage = await uploadMediaFile(mediaFile, mediaType, userId);

      res.status(200).json(mediaMessage);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private createGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { name, description, members } = req.body;
      if (!req.user?._id) throw new Error("Unauthorized");
      const createdBy = req.user._id as string;

      const validation = createGroupValidation.validate({
        name,
        description,
        members,
      });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const groupData: ICreateGroupRequest = {
        name,
        description,
        members, // Don't add creator to members - they're already in admins and createdBy
        createdBy,
      };

      const newGroup = await createGroup(groupData);
      if (!newGroup) throw new Error("Failed to create group");

      res.status(201).json(newGroup);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { groupId } = req.params;

      const group = await getGroupById(groupId);
      if (!group) throw new Error("Group not found");

      res.status(200).json(group);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getUserGroups = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;

      const groups = await getUserGroups(userId);
      res.status(200).json(groups);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private updateGroup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { groupId } = req.params;
      const updateData = req.body;

      const validation = updateGroupValidation.validate({
        groupId,
        ...updateData,
      });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const updatedGroup = await updateGroup({ groupId, ...updateData });
      if (!updatedGroup) throw new Error("Failed to update group");

      res.status(200).json(updatedGroup);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private addMember = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { groupId } = req.params;
      const { userId } = req.body;

      const validation = addMemberValidation.validate({ groupId, userId });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const success = await addMemberToGroup(groupId, userId);
      if (!success) throw new Error("Failed to add member to group");

      res.status(200).json({ message: "Member added successfully" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private removeMember = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { groupId, userId } = req.params;

      const validation = removeMemberValidation.validate({ groupId, userId });
      if (validation.error) {
        throw new Error(validation.error.details[0].message);
      }

      const success = await removeMemberFromGroup(groupId, userId);
      if (!success) throw new Error("Failed to remove member from group");

      res.status(200).json({ message: "Member removed successfully" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default ChatController;
