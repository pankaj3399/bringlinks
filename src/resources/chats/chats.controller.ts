import { Request, Response, NextFunction, Router } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import { findRoomChat, findUserChats, getChatHistory } from "./chats.service";
import { ChatTypes } from "./chats.interface";
import { RequiredAuth } from "../../middleware/auth.middleware";

class ChatController implements Controller {
  public path = "/chat";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/:chatid/:userId/:chatType`,
      RequiredAuth,
      this.getChatHistory
    );
    this.router.get(`${this.path}/:userId/:chatid`, this.userChats);
    this.router.get(`${this.path}/:roomId/:chatid`, this.roomChats);
  }
  private getChatHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { chatid, chatType } = req.params;
      if (!chatid) throw new Error("Id is required");
      const userId = req.user?._id;
      const chatHistory = await getChatHistory(
        chatType as ChatTypes,
        chatid,
        userId
      );
      if (!chatHistory) throw new Error("Chat is not found");
      Logging.info(chatHistory);
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
}

export default ChatController;
