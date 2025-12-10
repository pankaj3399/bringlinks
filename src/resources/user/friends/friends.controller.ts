import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../../utils/interfaces/controller.interface";
import HttpException from "../../../middleware/exceptions/http.exception";
import {
  addFriend,
  findFriend as getFriends,
  removeFriend as unFriend,
} from "./friends.service";
import ValidationMiddleware from "middleware/val.middleware";
import { createFriend } from "./friends.validation";

class FriendsController implements Controller {
  public path = "/friends";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/addfriend/:userId/:friendId`,
      ValidationMiddleware(createFriend),
      this.addFriend
    );
    this.router.delete(
      `${this.path}/removefriend/:userId/:friendId`,
      this.removeFriend
    );
    this.router.get(`${this.path}/:friendId`, this.getFriends);
  }

  private addFriend = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, friendId } = req.params;
      if (!userId || !friendId) res.status(400).send("Id is required");

      const foundFriend = await getFriends(friendId);
      if (foundFriend) res.status(204).send(foundFriend);

      const addedFriend = await addFriend(userId, friendId);
      if (!addedFriend) res.status(400).send("Friend not added");

      res.status(201).send(addedFriend);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private removeFriend = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, friendId } = req.params;
      if (!userId || !friendId) res.status(400).send("Id is required");

      const removedFriend = await unFriend(userId, friendId);
      if (!removedFriend) res.status(400).send("Friend not removed");

      res.status(200).send(removedFriend);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getFriends = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { friendId } = req.params;
      if (!friendId) res.status(400).send("Id is required");

      const foundedFriends = await getFriends(friendId);
      if (!foundedFriends) res.status(400).send("Friend not found");

      res.status(200).send(foundedFriends);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
}

export default FriendsController;
