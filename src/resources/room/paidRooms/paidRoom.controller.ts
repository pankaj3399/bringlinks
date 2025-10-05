import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../../utils/interfaces/controller.interface";
import HttpException from "../../../middleware/exceptions/http.exception";
import {
  addTickets,
  buyTickets,
  createNewPaidRoom,
  deletePaidRoom,
  getPaidRoom,
  returnPaidRoom,
  updatePaidRoom,
} from "./paidRoom.service";
import {
  isUserAccount,
  roomAdminPermissions,
  creatorPermissions,
} from "../../../middleware/authorization.middleware";
import {
  RequiredAuth,
  RequiredPaidRoomEntry,
} from "../../../middleware/auth.middleware";
import jwt from "../../../utils/authentication/jwt.createtoken";
import { canCreatePaidRooms } from "../../user/creator/creator.service";

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
      creatorPermissions,
      this.createNewPaidRoom
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
      `${this.path}/vault/card/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      this.vaultCard
    );
  }

  private createNewPaidRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      const { name, description, isPrivate, ticketPrice, maxTickets, ticketTiers } = req.body;
      const effectiveName = name || req.body.event_name;
      const effectiveDescription = description || req.body.event_description;
      const effectiveIsPrivate = typeof isPrivate === "boolean" ? isPrivate : (req.body.event_privacy === "private");

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      if (!effectiveName) {
        return res.status(400).json({ message: "Room name is required" });
      }
      if (!ticketPrice) {
        return res.status(400).json({ message: "Ticket price is required" });
      }
      if (!maxTickets) {
        return res.status(400).json({ message: "Max tickets is required" });
      }

      const eligibility = await canCreatePaidRooms(userId);

      if (!eligibility.canCreate) {
        if (eligibility.reason === "Stripe Connect account required" ||
            eligibility.reason === "Stripe Connect account not active") {
          return res.status(403).json({
            success: false,
            message: "Stripe Connect account required to create paid rooms",
            reason: eligibility.reason,
            redirectTo: "/creator/stripe-connect/onboard",
            action: "redirect_to_stripe_connect"
          });
        }

        return res.status(403).json({
          success: false,
          message: eligibility.reason,
          action: "creator_approval_required"
        });
      }

      const createdPaidRoom = await createNewPaidRoom(userId, {
        ...req.body,
        name: effectiveName,
        description: effectiveDescription,
        isPrivate: effectiveIsPrivate,
        ticketPrice,
        maxTickets,
        ticketTiers,
      });
      if (!createdPaidRoom) {
        return res.status(400).json({ message: "Paid room not created" });
      }

      res.status(201).json({
        success: true,
        message: "Paid room created successfully",
        paidRoom: createdPaidRoom,
      });
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
      if (!roomId) {
        return res.status(400).json({ message: "Room Id is required" });
      }

      const foundPaidRoom = await getPaidRoom(roomId);
      if (!foundPaidRoom) {
        return res.status(400).json({ message: "Paid room not found" });
      }

      res.status(200).json(foundPaidRoom);
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
      if (!roomId || !userId) {
        return res.status(400).json({ message: "Room ID and User ID are required" });
      }
      const { cardInfo } = req.body;
      if (!cardInfo) {
        return res.status(400).json({ message: "Card info is required" });
      }

      return res.status(503).json({ message: "Card vaulting temporarily disabled" });
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
      if (!roomId) return res.status(400).send("User Id is required");

      const createdPaidRoom = await addTickets(roomId, req.body);
      if (!createdPaidRoom) return res.status(400).send("Paid room not created");

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
      if (!roomId || !userId) return res.status(400).send("Id is required");

      const paidRoom = await returnPaidRoom(userId, req.body);
      if (!paidRoom) return res.status(400).send("Paid room not found");

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
      if (!roomId || !userId) return res.status(400).send("Id is required");

      // calculate total for ticket cost for customer

      // make call to lambda function
      // const paid = await HelcimService.purchaseTickets({
      //   cardToken: "",
      //   amount: 3,
      //   description: "",
      //   customerId: "",
      //   quantity: 3,
      // });

      const paid = { success: false, message: "Ticket purchase temporarily disabled" } as any;

      // update room Param replace with receiptId
      const updatedPaidRoom = await buyTickets(userId, req.body, userId);

      if (!updatedPaidRoom) return res.status(400).send({ message: paid });

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
      if (!roomId) return res.status(400).send("User Id is required");

      const updatedPaidRoom = await updatePaidRoom(req.body);
      if (!updatedPaidRoom) return res.status(400).send("Paid room not updated");

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
      if (!roomId) return res.status(400).send("User Id is required");

      const deletedPaidRoom = await deletePaidRoom(roomId);
      if (!deletedPaidRoom) return res.status(400).send("Paid room not deleted");

      res.status(200).send(deletedPaidRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default PaidRoomController;
