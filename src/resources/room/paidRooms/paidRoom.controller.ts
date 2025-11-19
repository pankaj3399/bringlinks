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
import Rooms from "../room.model";
import Creator from "../../user/creator/creator.model";
import StripeService from "../../../utils/stripe/stripe.service";
import { createRoomQRCode } from "../room.service";
import { invalidateCache, advancedCacheMiddleware } from "../../../middleware/cache.middleware";

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
    this.router.post(
      `${this.path}/rooms/:userId/:roomId/checkout`,
      RequiredAuth,
      isUserAccount,
      this.startCheckout
    );
    this.router.get(
      `/creator/:userId/stripe/login-link`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:stripe:loginlink:${req.params.userId}`,
        ttl: 3600
      }),
      this.getCreatorStripeLoginLink
    );
    this.router.get(
      `/creator/:userId/stripe/balance`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:stripe:balance:${req.params.userId}`,
        ttl: 600
      }),
      this.getCreatorStripeBalance
    );
    this.router.post(
      `/creator/:userId/stripe/payout`,
      RequiredAuth,
      isUserAccount,
      this.createCreatorPayout
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
      invalidateCache('paidroom', 'roomId'),
      this.updatePaidRoom
    );
    this.router.post(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      invalidateCache('paidroom', 'roomId'),
      this.addTickets
    );
    this.router.get(
      `${this.path}/rooms/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      RequiredPaidRoomEntry,
      roomAdminPermissions,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:paidroom:${req.params.userId}:${req.params.roomId}`,
        ttl: 1800
      }),
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
  private startCheckout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id; 
      const { roomId } = req.params;
      const { quantity = 1, tierName, successUrl, cancelUrl } = req.body;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      if (!roomId) return res.status(400).json({ message: "Room ID is required" });
      if (!tierName ||typeof tierName !== "string" || !tierName.trim()){
        return res.status(400).json({ message: "tierName is required"});
      }

      const roomDoc = await Rooms.findById(roomId).select("created_user");
      if (!roomDoc) return res.status(404).json({ message: "Room not found" });
      const creatorUserId = String((roomDoc as any).created_user);

      const eligibility = await canCreatePaidRooms(creatorUserId);
      if (!eligibility.canCreate) {
        return res.status(403).json({ success: false, message: eligibility.reason });
      }

      const paidRoom = await getPaidRoom(roomId);
      const tiers = paidRoom.tickets.pricing || [];
      if(!tiers ||tiers.length === 0) return res.status(404).json({ message: "No tiers set for this room" });
      const normalizedTier =String(tierName).trim().toLowerCase();
      const selected= tiers.find((t: any) =>{
        const title = String(t.title || "").trim().toLowerCase();
        const tierEnum= String(t.tiers || "").trim().toLowerCase();
        return title === normalizedTier ||tierEnum === normalizedTier;
      });
      if (!selected) return res.status(400).json({ message: "Tier not found" });
      if (selected.available < quantity) return res.status(400).json({ message: "Not enough tickets available" });
      const ticketAmount = selected.price;

      const metadata = {
        roomId: String(roomId),
        userId: String(userId),
        tier: selected.tiers,
        tierTitle: selected.title,
        quantity: String(quantity),
      } as Record<string, string>;

      
      const creator = await Creator.findOne({ userId: creatorUserId });
      if (!creator || !creator.stripeConnectAccountId) {
        return res.status(403).json({ message: "Stripe Connect account required" });
      }

      const session = await StripeService.createCheckoutSession({
        amount: ticketAmount,
        currency: "usd",
        connectedAccountId: creator.stripeConnectAccountId,
        successUrl,
        cancelUrl,
        quantity,
        productName: "Room Ticket",
        metadata,
      } as any);

      return res.status(200).json({ success: true, checkoutSessionId: session.id, url: session.url });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getCreatorStripeLoginLink = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      const creator = await Creator.findOne({ userId });
      if (!creator || !creator.stripeConnectAccountId) {
        return res.status(404).json({ message: "Creator Stripe account not found" });
      }
      const loginLink = await StripeService.createLoginLink(creator.stripeConnectAccountId);
      return res.status(200).json({ success: true, url: loginLink.url });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private createCreatorPayout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      let { amountCents } = req.body as { amountCents?: number };
      const creator = await Creator.findOne({ userId });
      if (!creator || !creator.stripeConnectAccountId) {
        return res.status(404).json({ message: "Creator Stripe account not found" });
      }

      const balance = await StripeService.getAccountBalance(creator.stripeConnectAccountId);
      const availableUsd= (balance.available ||[]).filter((b: any) => b.currency?.toLowerCase() ==="usd");
      const availableCents= availableUsd.reduce((sum: number, b: any) => sum +(Number(b.amount) || 0),0);

      if (!amountCents|| amountCents <= 0){
        amountCents = availableCents;
      }

      if (amountCents <= 0){
        return res.status(400).json({ message: "No available balance to payout" });
      }

      if (amountCents > availableCents){
        return res.status(400).json({ message: "Payout amount exceeds available balance", availableCents });
      }

      const payout = await StripeService.createPayout(creator.stripeConnectAccountId, amountCents, "usd");
      return res.status(200).json({ success: true, payout });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getCreatorStripeBalance =async(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response |void> =>{
    try {
      const userId = req.user?._id;
      const creator = await Creator.findOne({ userId });
      if (!creator || !creator.stripeConnectAccountId) {
        return res.status(404).json({ message: "Creator Stripe account not found" });
      }
      const balance = await StripeService.getAccountBalance(creator.stripeConnectAccountId);
      return res.status(200).json({ success: true, balance });
    } catch (err: any){
      return next(new HttpException(400, err.message));
    }
  };

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

      const qrCode = await createRoomQRCode(createdPaidRoom.room._id);

      res.status(201).json({
        success: true,
        message: "Paid room created successfully",
        paidRoom: createdPaidRoom,
        qrCode: qrCode,
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
      const updatedPaidRoom = await buyTickets(userId, { ...req.body, roomId }, userId);

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
