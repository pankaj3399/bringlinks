import { Router, Request, Response, NextFunction } from "express";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import Controller from "utils/interfaces/controller.interface";
import {
  acceptRoomInvite,
  addAnAdmin,
  addFlyerIMG,
  addMediaImage,
  addSpecialGuest,
  addSponsor,
  addVenueImage,
  addVenueVerificationIMG,
  createRoomQRCode,
  createRoom,
  deleteRoom,
  getAllRooms,
  getARoom,
  getIMG,
  getRelatedRooms,
  getRoomBy,
  getRoomsByText,
  incomingInvite,
  inviteAUser,
  removeAnAdmin,
  roomsGetallPaginated,
  roomsNearBy,
  roomsNearByPaginated,
  unInviteAUser,
  updateRoom,
  getQRCode,
  createPurchaseQRCode,
  createEntryQRCode,
  getRoomDemographics,
} from "./room.service";
import {
  generateShareLinks,
  trackShare,
  trackClick,
  getRoomShareAnalytics,
} from "./share.service";
import { SharePlatform, ShareType } from "./share.model";
import validationMiddleware from "../../middleware/val.middleware";
import validate from "./room.validation";
import {
  roomAdminPermissions,
  enteredRoomPermissions,
  isInvitedPermissions,
  isUserAccount,
  isRoomPrivate,
} from "../../middleware/authorization.middleware";
import {
  FileType,
  generateFilename,
  getPutObjectCommand,
} from "../../utils/ImageServices/helperFunc.ts/room.Img";
import { RequiredAuth } from "../../middleware/auth.middleware";
import fileUpload, { UploadedFile } from "express-fileupload";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { uploadRoomImage } from "../../utils/ImageServices/roomFlyer.Img";
import mongoose from "mongoose";
var toId = mongoose.Types.ObjectId;

class RoomController implements Controller {
  public path = "/rooms";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/:userId`,
      validationMiddleware(validate.createRoom),
      RequiredAuth,
      this.createRoom
    );
    this.router.get(
      `${this.path}/findroom/:userId`,
      RequiredAuth,
      this.getRoomById
    );
    this.router.get(
      `${this.path}/search/description/:userId`,
      RequiredAuth,
      this.getRoomsByText
    );
    this.router.get(
      `${this.path}/search/related/:userId`,
      RequiredAuth,
      this.getRelatedRooms
    );
    this.router.get(
      `${this.path}/nearby/:userId`,
      RequiredAuth,
      isUserAccount,
      this.getRoomNearby
    );
    this.router.get(
      `${this.path}/nearbypaginated/:userId`,
      RequiredAuth,
      isUserAccount,
      this.getRoomNearbyPaginated
    );
    this.router.post(
      `${this.path}/findby/:userId`,
      validationMiddleware(validate.validateRoomFindBy),
      RequiredAuth,
      this.getRoomBy
    );
    this.router.get(`${this.path}/allrooms`, RequiredAuth, this.getAllRooms);
    this.router.get(
      `${this.path}/allroomspaginated`,
      RequiredAuth,
      this.getAllRoomsPaginated
    );
    this.router.get(
      `${this.path}/demographics/:userId/:roomId`,
      RequiredAuth,
      this.getRoomDemographics
    );
    this.router.delete(
      `${this.path}/deleteroom/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.deleteRoom
    );
    this.router.put(
      `${this.path}/editroom/:userId/:roomId`,
      validationMiddleware(validate.editARoom),
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.editARoom
    );
    this.router.post(
      `${this.path}/addadmin/:userId/:roomId/:adminId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.addAnAdmin
    );
    this.router.post(
      `${this.path}/incominginvite/:userId/:roomId`,
      RequiredAuth,
      enteredRoomPermissions,
      this.incomingInvite
    );
    this.router.post(
      `${this.path}/inviteuser/:userId/:roomId`,
      RequiredAuth,
      enteredRoomPermissions,
      this.inviteUser
    );
    this.router.delete(
      `${this.path}/uninvite/:userId/:roomId`,
      RequiredAuth,
      roomAdminPermissions,
      this.unInviteUser
    );
    this.router.delete(
      `${this.path}/removeanadmin/:userId/:roomId/:adminId`,
      RequiredAuth,
      roomAdminPermissions,
      this.removeAnAdmin
    );
    this.router.post(
      `${this.path}/accept/:userId/:roomId`,
      RequiredAuth,
      roomAdminPermissions,
      isInvitedPermissions,
      this.acceptRoomInvite
    );
    this.router.put(
      `${this.path}/image/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.uploadIMG
    );
    this.router.put(
      `${this.path}/image/media/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      this.uploadMediaIMG
    );
    this.router.get(
      `${this.path}/image/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      this.retrieveImg
    );
    this.router.post(
      `${this.path}/addspecialguest/:userId/:roomId/:addedguest`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      validationMiddleware(validate.addSpecialGuest),
      this.addGuest
    );
    this.router.post(
      `${this.path}/addsponsor/:userId/:roomId`,
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      validationMiddleware(validate.addSponsor),
      this.addSponsor
    );

    this.router.get(
      `${this.path}/getqrcode/:roomId`,
      RequiredAuth,
      isRoomPrivate,
      this.getRoomQRCode
    );
    this.router.get(
      `${this.path}/purchase-qr/:roomId`,
      RequiredAuth,
      this.getPurchaseQRCode
    );
    this.router.get(
      `${this.path}/purchase-qr-public/:roomId`,
      this.getPurchaseQRCodePublic
    );
    this.router.get(
      `${this.path}/entry-qr/:roomId/:userId`,
      RequiredAuth,
      this.getEntryQRCode
    );
    this.router.get(`${this.path}/:roomId/share-links`, this.getShareLinks);
    this.router.post(`${this.path}/:roomId/share`, this.trackShare);
    this.router.get(
      `${this.path}/:roomId/share-analytics`,
      RequiredAuth,
      this.getShareAnalytics
    );
    this.router.get(
      `${this.path}/share/:platform/:encodedUrl`,
      this.handleShareClick
    );
    this.router.get(`${this.path}/:roomId`, this.getRoomByIdPublic);
  }

  private uploadMediaIMG = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { fileType } = req.query;

      if (fileType !== FileType.media)
        res.status(400).send({ message: "Invalid file type" });
      if (!roomId) res.status(400).send("Id is required");

      const { media } = req.files as {
        media?: UploadedFile | UploadedFile[];
      };

      const mediaFiles: UploadedFile[] = Array.isArray(media)
        ? media
        : media
        ? [media]
        : [];

      await Promise.all(
        mediaFiles.map(async (file: UploadedFile) => {
          const mediaFileName = generateFilename(
            fileType as FileType,
            file.name as string,
            roomId
          );

          const mediaCommand = getPutObjectCommand(
            fileType as FileType,
            mediaFileName,
            file.mimetype,
            file.data
          );
          Logging.warning(mediaCommand);
          await uploadRoomImage(mediaCommand as PutObjectCommand);
          await addMediaImage(roomId, mediaFileName);
        })
      ).catch((err) => {
        Logging.error(err);
      });
      const url = await getIMG(roomId, fileType as FileType);
      res.status(201).send({ url });
    } catch (err: any) {
      next(new HttpException(400, err));
    }
  };

  private getRoomQRCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) res.status(400).send("Id is needed");

      const qrCode = await getQRCode(roomId);
      if (!qrCode)
        return res.status(400).json({ message: "QR code not found" });

      res.status(200).json({ qrCode, type: "room" });
    } catch (err: any) {
      next(new HttpException(400, err));
    }
  };

  private getPurchaseQRCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { tier } = req.query;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });
      if (!tier)
        return res.status(400).json({ message: "Tier name is required" });

      const qrCode = await createPurchaseQRCode(roomId, tier as string);
      if (!qrCode)
        return res.status(400).json({ message: "Purchase QR code not found" });

      res.status(200).json({ qrCode, type: "purchase" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getRoomDemographics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      if (!roomId) return res.status(400).send("Id is required");

      const demographics = await getRoomDemographics(roomId);

      if (!demographics) return res.status(400).send("Demographics not found");

      res.status(200).json(demographics);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getPurchaseQRCodePublic = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { tier } = req.query;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });
      if (!tier)
        return res.status(400).json({ message: "Tier name is required" });

      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid room ID format" });
      }

      const qrCode = await createPurchaseQRCode(roomId, tier as string);
      if (!qrCode)
        return res.status(400).json({ message: "Purchase QR code not found" });

      res.status(200).json({ qrCode, type: "purchase" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getEntryQRCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, userId } = req.params;
      const { ticketId } = req.query;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });
      if (!userId)
        return res.status(400).json({ message: "User ID is required" });

      const qrCode = await createEntryQRCode(
        roomId,
        userId,
        ticketId as string
      );
      if (!qrCode)
        return res.status(400).json({ message: "Entry QR code not found" });

      res.status(200).json({ qrCode, type: "entry" });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getRoomById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.query;

      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: "Room ID is required",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(roomId as string)) {
        return res.status(400).json({
          success: false,
          message: "Invalid room ID format",
        });
      }

      const room = await getARoom(roomId as string);

      return res.status(200).json({
        success: true,
        room,
      });
    } catch (err: any) {
      Logging.error(`Error getting room: ${err.message}`);
      if (err.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: err.message,
        });
      }
      next(new HttpException(500, err.message));
    }
  };

  private getRoomByIdPublic = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });

      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid room ID format" });
      }

      const room = await getARoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });

      const publicRoomData = {
        _id: room._id,
        event_name: room.event_name,
        event_type: room.event_type,
        event_typeOther: room.event_typeOther,
        event_description: room.event_description,
        event_location_address: room.event_location_address,
        event_location: room.event_location,
        event_schedule: room.event_schedule,
        event_privacy: room.event_privacy,
        paid: room.paid,
        created_user: room.created_user,
        event_flyer_img: room.event_flyer_img,
        event_media_img: room.event_media_img,
        event_venue_image: room.event_venue_image,
        specialGuest: room.specialGuest,
        event_sponsors: room.event_sponsors,
        shares: room.shares,
        stats: room.stats,
      };

      res.status(200).json(publicRoomData);
    } catch (err: any) {
      Logging.error(err);
      next(new HttpException(404, err.message));
    }
  };
  private getRoomBy = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const key = Object.keys(req.body)[0];
      const room = await getRoomBy(req.body, key);

      if (!room) return res.status(400).send("Room not found");

      Logging.info(room);
      res.status(200).json(room);
    } catch (err: any) {
      Logging.error(err);
      next(new HttpException(400, err.message));
    }
  };

  private getAllRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const allRooms = await getAllRooms();
      if (!allRooms) return res.status(400).send("rooms not found");

      Logging.info(allRooms);
      res.status(200).json(allRooms);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private createRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { paid } = req.query;
      if (!userId) return res.status(400).send("Id is required");
      if (paid) return res.status(400).send("paid is required");

      //create event into room
      const createdRoom = await createRoom(req.body, userId);
      if (!createdRoom) return res.status(400).send(`room couldn't be created`);

      // create qr code for room
      const qrCode = await createRoomQRCode(createdRoom._id);
      if (!qrCode) return res.status(400).send(`qr code couldn't be created`);

      Logging.info(createdRoom);
      res.status(201).send({ createdRoom, qrCode });
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private deleteRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const deletedRoom = await deleteRoom(userId, roomId);

      if (!deletedRoom) return res.status(400).send("Room not deleted");
      Logging.info(deletedRoom);
      res.status(200).send(deletedRoom);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private editARoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const updatedRoom = await updateRoom(req.body, userId, roomId);
      if (!updatedRoom) return res.status(400).send("Room not updated");

      Logging.info(updatedRoom);
      res.status(201).send(updatedRoom);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private addAnAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, adminId } = req.params;
      if (!adminId || !roomId) return res.status(400).send("Id is required");

      const room = await addAnAdmin(roomId, adminId);
      if (!room) return res.status(400).send("Room admin not added");

      res.status(202).send(room);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  //invitation by a user to a room
  private incomingInvite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const room = await incomingInvite(userId, roomId);
      if (!room) return res.status(400).send("Room invite not sent");
      res.status(201).send(room);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private getRoomsByText = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomQuery } = req.query;
      if (!roomQuery)
        return res.status(400).send("roomQuery text for search is required");

      const foundedRooms = await getRoomsByText(roomQuery as string);
      if (!foundedRooms)
        return res.status(400).send({ message: "Room not found" });

      Logging.info(foundedRooms);
      res.status(200).json(foundedRooms);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  private getRelatedRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const foundedRooms = await getRelatedRooms(userId);
      if (!foundedRooms)
        return res.status(400).send({ message: "Room not found" });

      Logging.info(foundedRooms);
      res.status(200).json(foundedRooms);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  //invitation by a user by room attendees
  private inviteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, userId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const room = await inviteAUser(roomId, userId as string);

      if (!room) return res.status(400).send("Room invite not sent");
      res.status(200).send(room);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private unInviteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { inviteeId } = req.query;

      if (!inviteeId || !roomId) return res.status(400).send("Id is required");

      const modifiedCount = await unInviteAUser(inviteeId as string, roomId);

      if (modifiedCount === 0) return res.status(200).send(modifiedCount);

      if (modifiedCount === 1) return res.status(201).send(modifiedCount);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private removeAnAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const room = await removeAnAdmin(userId, roomId);
      if (!room) return res.status(400).send("Room not deleted");
      res.status(201).send(room);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  private acceptRoomInvite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) return res.status(400).send("Id is required");

      const room = await acceptRoomInvite(userId, roomId);
      if (!room) return res.status(400).send("Room invite not accepted");
      res.status(200).send(room);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  private getRoomNearby = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { lng, ltd } = req.query;
      if (!userId) return res.status(400).send("User Id is required");
      if (lng == null || ltd == null)
        return res.status(400).send("Location is needed");

      const lngNum = Number(String(lng).replace(/\s+/g, ""));
      const ltdNum = Number(String(ltd).replace(/\s+/g, ""));
      if (!Number.isFinite(lngNum) || !Number.isFinite(ltdNum)) {
        return res.status(400).send("Invalid location coordinates");
      }

      const nearByRooms = await roomsNearBy(userId, lngNum, ltdNum);
      if (!nearByRooms) return res.status(200).send(`rooms couldn't be found`);

      Logging.info(nearByRooms);
      res.status(201).json(nearByRooms);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  private getAllRoomsPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { page, limit } = req.query;
      if (!page) return res.status(400).send("Page is needed");
      if (!limit) return res.status(400).send("Limit is needed");

      const limitNum = Number(limit);
      const pageNum = Number(page);
      // Calculate the number of documents to skip
      const skip = limitNum * (pageNum - 1);
      const paginatedRooms = await roomsGetallPaginated(skip, limitNum);
      if (!paginatedRooms)
        return res.status(400).send(`room couldn't be found`);

      Logging.info(paginatedRooms);
      res.status(200).json(paginatedRooms);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };
  private getRoomNearbyPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { lng, ltd, page, limit } = req.query;
      if (!userId) return res.status(400).send("User Id is required");
      if (lng == null || ltd == null)
        return res.status(400).send("Location is needed");
      if (!page) return res.status(400).send("Page is needed");
      if (!limit) return res.status(400).send("Limit is needed");

      const limitNum = Number(limit);
      const pageNum = Number(page);
      // Calculate the number of documents to skip
      const skip = (pageNum - 1) * limitNum;

      const lngNum = Number(String(lng).replace(/\s+/g, ""));
      const ltdNum = Number(String(ltd).replace(/\s+/g, ""));
      if (!Number.isFinite(lngNum) || !Number.isFinite(ltdNum)) {
        return res.status(400).send("Invalid location coordinates");
      }

      const nearByRooms = await roomsNearByPaginated(
        userId,
        lngNum,
        ltdNum,
        skip,
        limitNum
      );
      if (!nearByRooms) return res.status(400).send(`room couldn't be found`);

      Logging.info(nearByRooms);
      res.status(201).json(nearByRooms);
    } catch (err: any) {
      next(new HttpException(401, err.message));
    }
  };

  private retrieveImg = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const foundImage = await getIMG(roomId);

      res.status(200).send(foundImage);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
  private uploadIMG = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { fileType } = req.query;

      if (!req.files)
        return res.status(400).send({ message: "No files uploaded" });
      if (!fileType) return res.status(400).send({ message: "No file type" });

      const { flyer, venue, venueVerification } = req.files as {
        flyer?: UploadedFile;
        venue?: UploadedFile | UploadedFile[];
        venueVerification?: UploadedFile;
      };

      switch (fileType) {
        case FileType.flyer:
          let fileName = generateFilename(
            fileType,
            flyer?.name as string,
            roomId
          );
          const flyerCommand = getPutObjectCommand(
            fileType,
            fileName,
            flyer?.mimetype as string,
            flyer?.data as Buffer
          );
          await uploadRoomImage(flyerCommand as PutObjectCommand);
          await addFlyerIMG(roomId, fileName);
          const signedUrl = await getIMG(roomId, fileType);
          res.status(201).send({ signedUrl });
          break;
        case FileType.venue: {
          const venueFiles: UploadedFile[] = Array.isArray(venue)
            ? venue
            : venue
            ? [venue]
            : [];

          await Promise.all(
            venueFiles.map(async (file: UploadedFile) => {
              const venueFileName = generateFilename(
                fileType,
                file.name as string,
                roomId
              );
              const venueCommand = getPutObjectCommand(
                fileType,
                venueFileName,
                file.mimetype,
                file.data
              );
              await uploadRoomImage(venueCommand as PutObjectCommand);
              await addVenueImage(roomId, venueFileName);
            })
          ).then((res) => {
            Logging.log(res);
          });

          const returnUrl = await getIMG(roomId, fileType);
          res.status(201).send({ returnUrl });
          break;
        }
        case FileType.venueVerification:
          let venueVerificationFileName = generateFilename(
            fileType,
            venueVerification?.name as string,
            roomId
          );
          const venueVerificationCommand = getPutObjectCommand(
            fileType,
            venueVerificationFileName,
            venueVerification?.mimetype as string,
            venueVerification?.data as Buffer
          );
          await uploadRoomImage(venueVerificationCommand as PutObjectCommand);
          await addVenueVerificationIMG(roomId, venueVerificationFileName);
          const signedVenueVerificationUrl = await getIMG(roomId, fileType);
          res.status(201).send({ signedVenueVerificationUrl });
          break;
        default:
          return res.status(400).send({ message: "No file type" });
      }
    } catch (err: any) {
      Logging.error(err);
      next(new HttpException(400, err));
    }
  };
  private addGuest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      const { addedguest } = req.query;

      if (!userId || !roomId || !addedguest)
        return res.status(400).send("Id is required");

      const user_Id = addedguest as string;
      const room_Id = roomId as string;

      const addedGuest = await addSpecialGuest(userId, {
        userId: new mongoose.Types.ObjectId(user_Id) as any,
        roomId: new mongoose.Types.ObjectId(room_Id) as any,
        name: req.body.name,
        type: req.body.type,
      });

      if (!addedGuest) res.status(400).send(addedGuest);

      res.status(201).send(addedGuest);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private addSponsor = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      const { addedguest } = req.query;

      if (!userId || !roomId || !addedguest)
        return res.status(400).send("Id is required");

      const addedGuest = await addSponsor(userId, roomId, req.body);

      if (!addedGuest)
        return res.status(400).send({ message: "Sponsor not added" });

      res.status(201).send(addedGuest);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getShareLinks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { shareType = ShareType.ROOM_ACCESS, tierName, userId } = req.query;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });

      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid room ID format" });
      }

      const shareLinks = await generateShareLinks(
        roomId,
        shareType as ShareType,
        userId as string,
        tierName as string
      );

      res.status(200).json({
        success: true,
        roomId,
        shareType,
        shareLinks,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private trackShare = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const {
        platform,
        shareType = ShareType.ROOM_ACCESS,
        tierName,
        userId,
      } = req.body;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });
      if (!platform)
        return res.status(400).json({ message: "Platform is required" });

      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid room ID format" });
      }

      const result = await trackShare(
        roomId,
        platform as SharePlatform,
        shareType as ShareType,
        userId
      );

      res.status(200).json({
        success: true,
        shareId: result.shareId,
        shareUrl: result.shareUrl,
        platform: result.platform,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getShareAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;

      if (!roomId)
        return res.status(400).json({ message: "Room ID is required" });

      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid room ID format" });
      }

      const analytics = await getRoomShareAnalytics(roomId);

      res.status(200).json({
        success: true,
        roomId,
        analytics,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private handleShareClick = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { platform, encodedUrl } = req.params;

      if (!platform || !encodedUrl) {
        return res
          .status(400)
          .json({ message: "Platform and encoded URL are required" });
      }

      let originalUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");

      if (
        !originalUrl.startsWith("http://") &&
        !originalUrl.startsWith("https://")
      ) {
        originalUrl = `http://${originalUrl}`;
      }

      const shareUrl = `${req.protocol}://${req.get(
        "host"
      )}/rooms/share/${platform}/${encodedUrl}`;

      await trackClick(shareUrl);

      res.redirect(originalUrl);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default RoomController;
