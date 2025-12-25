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
  getItineraryByRoomId,
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

      const createdItinerary = await createItinerary(req.body as any, roomId as any);
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
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const foundItinerary = await getItineraryByRoomId(roomId);
      if (!foundItinerary) return res.status(400).send("Itinerary not found");

      Logging.info(foundItinerary);
      return res.status(200).json(foundItinerary);
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
      const { _id } = req.body as any;

      if (!userId || !roomId) return res.status(400).send("Id is required");
      if (!_id) return res.status(400).send("Itinerary _id is required");

      const updatedItineraryById = await updateItinerary(_id, req.body);
      if (!updatedItineraryById)
        return res.status(400).send("Itinerary not updated");

      Logging.info(updatedItineraryById);
      return res.status(200).json(updatedItineraryById);
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
        return res.status(400).send("Id is required");

      const deletedItinerary = await deleteItinerary(
        itineraryId as string,
        roomId
      );
      Logging.info(deletedItinerary);

      if (!deletedItinerary) return res.status(400).send("Itinerary not deleted");

      return res.status(200).json(deletedItinerary);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default ItineraryController;
