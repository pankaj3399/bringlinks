import { NextFunction, Router, Request, Response } from "express";
import {
  RequiredAuth,
  RequiredPaidRoomEntry,
} from "../../../middleware/auth.middleware";
import HttpException from "../../../middleware/exceptions/http.exception";
import Logging from "../../../library/logging";
import Controller from "../../../utils/interfaces/controller.interface";
import {
  createItinerary,
  deleteItinerary,
  getItineraryById,
  updateItinerary,
} from "./itinerary.service";
import mongoose from "mongoose";
import { IRoomsDocument } from "../room.interface";
import { roomAdminPermissions } from "../../../middleware/authorization.middleware";
import validate from "./itinerary.validation";
import validationMiddleware from "../../../middleware/val.middleware";


class ItineraryController implements Controller {
  public path = "/itinerary";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/:userId/:roomId`,
      RequiredAuth,
      this.getItinerary
    );
    this.router.post(
      `${this.path}/:userId/:roomId`,
      RequiredAuth,
      roomAdminPermissions,
      validationMiddleware(validate.createItinerary),
      this.createItinerary
    );
    this.router.delete(
      `${this.path}/:userId/:roomId`,
      RequiredAuth,
      roomAdminPermissions,
      this.deleteItinerary
    );
    this.router.patch(
      `${this.path}/:userId/:roomId`,
      RequiredAuth,
      roomAdminPermissions,
      validationMiddleware(validate.updateItinerary),
      this.updateItinerary
    );
  }
  private createItinerary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) throw new Error("Id is required");

      const _id = roomId as string;
      const roomRef = { _id } as Pick<IRoomsDocument, "_id">;

      const createdItinerary = await createItinerary(req.body, roomRef);
      if (!createdItinerary) throw new Error("Itinerary not created");

      Logging.info(createdItinerary);
      res.status(201).json(createdItinerary);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getItinerary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const foundItinerary = await getItineraryById(roomId);
      if (!foundItinerary) res.status(400).send("Itinerary not found");

      Logging.info(foundItinerary);
      res.status(200).json(foundItinerary);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
  private updateItinerary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const updatedItineraryById = await updateItinerary(roomId, req.body);
      if (!updatedItineraryById) res.status(400).send(updatedItineraryById);

      Logging.info(updatedItineraryById);
      res.status(201).json(updatedItineraryById);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
  private deleteItinerary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      const { itineraryId } = req.query;

      if (!userId || !roomId || !itineraryId)
        res.status(400).send("Id is required");

      const deletedItinerary = await deleteItinerary(
        itineraryId as string,
        roomId
      );
      Logging.info(deletedItinerary);

      if (!deletedItinerary) res.status(400).send("Itinerary not deleted");

      res.status(200).json(deletedItinerary);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default ItineraryController;
