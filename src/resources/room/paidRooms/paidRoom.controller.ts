import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../../utils/interfaces/controller.interface";
import HttpException from "../../../middleware/exceptions/http.exception";
import {
  addTickets,
  buyTickets,
  createPaidRoom,
  deletePaidRoom,
  getPaidRoom,
  returnPaidRoom,
  updatePaidRoom,
} from "./paidRoom.service";
import {
  isUserAccount,
  roomAdminPermissions,
} from "../../../middleware/authorization.middleware";
import {
  RequiredAuth,
  RequiredPaidRoomEntry,
} from "../../../middleware/auth.middleware";
import jwt from "../../../utils/authentication/jwt.createtoken";
import HelcimService from "../../../utils/helcim/helcim";

class PaidRoomController implements Controller {
  public path = "/purchase";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/rooms/:userId`,
      RequiredAuth,
      roomAdminPermissions,
      this.createPaidRoom
    );
    this.router.patch(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      this.purchaseTickets
    );
    this.router.patch(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.updatePaidRoom
    );
    this.router.post(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.addTickets
    );
    this.router.get(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      RequiredPaidRoomEntry,
      roomAdminPermissions,
      this.getPaidRoom
    );
    this.router.post(
      `${this.path}/return/rooms/:userId/:roomId`,
      RequiredAuth,
      RequiredPaidRoomEntry,
      isUserAccount,
      this.returnPaidRoom
    );
    this.router.delete(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.deletePaidRoom
    );
    this.router.post(
      `${this.path}/purchase/vault/card/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      this.vaultCard
    );
  }

  private createPaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.body;
      if (!roomId) res.status(400).send("roomId is required in body");

      const createdPaidRoom = await createPaidRoom(roomId, req.body);
      if (!createdPaidRoom) res.status(400).send("Paid room not created");

      res.status(201).send(createdPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getPaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) res.status(400).send("User Id is required");

      const foundPaidRoom = await getPaidRoom(roomId);
      if (!foundPaidRoom) res.status(400).send("Paid room not found");

      res.status(200).send(foundPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
  private vaultCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, userId } = req.params;
      if (!roomId || !userId) res.status(400).send("Id is required");
      const { cardInfo } = req.body;
      if (!cardInfo) res.status(400).send("Card info is required");

      const createdPaidRoom = await HelcimService.vaultCard(cardInfo);
      if (!createdPaidRoom) res.status(400).send("Paid room not created");

      res.status(201).send(createdPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private addTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) res.status(400).send("User Id is required");

      const createdPaidRoom = await addTickets(roomId, req.body);
      if (!createdPaidRoom) res.status(400).send("Paid room not created");

      res.status(201).send(createdPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private returnPaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, userId } = req.params;
      if (!roomId || !userId) res.status(400).send("Id is required");

      const paidRoom = await returnPaidRoom(userId, req.body);
      if (!paidRoom) res.status(400).send("Paid room not found");

      res.status(200).send(paidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private purchaseTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, userId } = req.params;
      if (!roomId || !userId) res.status(400).send("Id is required");

      // calculate total for ticket cost for customer

      // make call to lambda function
      const paid = await HelcimService.purchaseTickets({
        cardToken: "",
        amount: 3,
        description: "",
        customerId: "",
        quantity: 3,
      });

      // update room Param replace with receiptId
      const updatedPaidRoom = await buyTickets(userId, req.body, userId);

      if (!updatedPaidRoom) res.status(400).send({ message: paid });

      // create token
      const [token] = jwt.CreateToken({
        roomId: roomId,
        userId: userId,
        role: req.user?.role,
      });

      if (!token) return res.status(400).json({ message: "Token not created" });
      res.status(201).send({
        token: token,
        updatePaidRoom: updatedPaidRoom,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private updatePaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) res.status(400).send("User Id is required");

      const updatedPaidRoom = await updatePaidRoom(req.body);
      if (!updatedPaidRoom) res.status(400).send("Paid room not updated");

      res.status(201).send(updatedPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private deletePaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) res.status(400).send("User Id is required");

      const deletedPaidRoom = await deletePaidRoom(roomId);
      if (!deletedPaidRoom) res.status(400).send("Paid room not deleted");

      res.status(200).send(deletedPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default PaidRoomController;
