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
} from "./room.service";
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
      `${this.path}/allroomspaginated/`,
      RequiredAuth,
      this.getAllRoomsPaginated
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
      fileUpload(),
      RequiredAuth,
      isUserAccount,
      roomAdminPermissions,
      this.uploadIMG
    );
    this.router.put(
      `${this.path}/image/media/:userId/:roomId`,
      fileUpload(),
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
      isUserAccount,
      isInvitedPermissions,
      isRoomPrivate,
      this.getRoomQRCode
    );
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
        media?: UploadedFile[];
      };

      await Promise.all(
        media?.map(async (file, index) => {
          let mediaFileName = generateFilename(
            fileType as FileType,
            media[index].name as string,
            roomId
          );

          let mediaCommand = getPutObjectCommand(
            fileType as FileType,
            mediaFileName,
            media[index].mimetype,
            media[index].data
          );
          Logging.warning(mediaCommand);
          await uploadRoomImage(mediaCommand as PutObjectCommand);
          await addMediaImage(roomId, mediaFileName);
        }) || []
      ).catch((err) => {
        Logging.error(err);
      });
      const url = await getIMG(roomId, fileType as FileType);
      Logging.log(fileType);
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
      if (!qrCode) res.status(400).send("QR code not found");

      res.status(200).send(qrCode);
    } catch (err: any) {
      next(new HttpException(400, err));
    }
  };

  private getRoomById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.query;

      if (!roomId) res.status(400).send("Id is needed");

      const room = await getARoom(roomId as string);

      if (!room) res.status(400).send("Room not found");

      Logging.info(room);
      res.status(200).json(room);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(404, err.messaged);
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

      if (!room) res.status(400).send("Room not found");

      Logging.info(room);
      res.status(200).json(room);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(400, err.message);
    }
  };

  private getAllRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const allRooms = await getAllRooms();
      if (!allRooms) res.status(400).send("rooms not found");

      Logging.info(allRooms);
      res.status(200).json(allRooms);
    } catch (err: any) {
      new HttpException(400, err.message);
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
      if (!userId) res.status(400).send("Id is required");
      if (paid) res.status(400).send("paid is required");

      //create event into room
      const createdRoom = await createRoom(req.body, userId);
      if (!createdRoom) res.status(400).send(`room couldn't be created`);

      // create qr code for room
      const qrCode = await createRoomQRCode(createdRoom._id);
      if (!qrCode) res.status(400).send(`qr code couldn't be created`);

      Logging.info(createdRoom);
      res.status(201).send({ createdRoom, qrCode });
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };

  private deleteRoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const deletedRoom = await deleteRoom(userId, roomId);

      if (!deletedRoom) res.status(400).send("Room not deleted");
      Logging.info(deletedRoom);
      res.status(200);
    } catch (err: any) {
      new HttpException(400, err.message);
    }
  };

  private editARoom = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const updatedRoom = await updateRoom(req.body, userId, roomId);
      if (!updatedRoom) res.status(400).send("Room not updated");

      Logging.info(updatedRoom);
      res.status(201).send(updateRoom);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };

  private addAnAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId, adminId } = req.params;
      if (!adminId || !roomId) res.status(400).send("Id is required");

      const room = await addAnAdmin(roomId, adminId);
      if (!room) res.status(400).send("Room admin not added");

      res.status(202).send(room);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };
  private incomingInvite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const room = await incomingInvite(userId, roomId);
      if (!room) res.status(400).send("Room invite not sent");
      res.status(201).send(room);
    } catch (err: any) {
      new HttpException(401, err.message);
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
        res.status(400).send("roomQuery text for search is required");

      const foundedRooms = await getRoomsByText(roomQuery as string);
      if (!foundedRooms) res.status(400).send({ message: "Room not found" });

      Logging.info(foundedRooms);
      res.status(200).json(foundedRooms);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };
  private getRelatedRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) res.status(400).send("Id is required");

      const foundedRooms = await getRelatedRooms(userId);
      if (!foundedRooms) res.status(400).send({ message: "Room not found" });

      Logging.info(foundedRooms);
      res.status(200).json(foundedRooms);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };

  private inviteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomId } = req.params;
      const { inviteeId } = req.query;
      if (!inviteeId || !roomId) res.status(400).send("Id is required");

      const room = await inviteAUser(roomId, inviteeId as string);

      if (!room) res.status(400).send("Room invite not sent");
      res.status(200).send(room);
    } catch (err: any) {
      new HttpException(401, err.message);
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

      if (!inviteeId || !roomId) res.status(400).send("Id is required");

      const modifiedCount = await unInviteAUser(inviteeId as string, roomId);

      if (modifiedCount === 0) res.status(200).send(modifiedCount);

      if (modifiedCount === 1) res.status(201).send(modifiedCount);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };

  private removeAnAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const room = await removeAnAdmin(userId, roomId);
      if (!room) res.status(400).send("Room not deleted");
      res.status(201).send(room);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };
  private acceptRoomInvite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId, roomId } = req.params;
      if (!userId || !roomId) res.status(400).send("Id is required");

      const room = await acceptRoomInvite(userId, roomId);
      if (!room) res.status(400).send("Room invite not accepted");
      res.status(200).send(room);
    } catch (err: any) {
      new HttpException(401, err.message);
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
      Logging.log(`Longitude: ${lng}, Latitude: ${ltd}`);
      if (!userId) res.status(400).send("User Id is required");
      if (!lng && !ltd) res.status(400).send("Location is needed");

      const nearByRooms = await roomsNearBy(userId, Number(lng), Number(ltd));
      if (!nearByRooms) res.status(200).send(`rooms couldn't be found`);

      Logging.info(nearByRooms);
      res.status(201).json(nearByRooms);
    } catch (err: any) {
      new HttpException(401, err.message);
    }
  };
  private getAllRoomsPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { page, limit } = req.query;
      if (!page) throw new Error("Page is needed");
      if (!limit) throw new Error("Limit is needed");

      Logging.log(`the limit is ${limit}`);
      Logging.log(`the page is ${page}`);
      const limitNum = Number(limit);
      const pageNum = Number(page);
      // Calculate the number of documents to skip
      const skip = limitNum * (pageNum - 1);
      Logging.log(`the skip is ${skip}`);
      Logging.log(pageNum);
      const paginatedRooms = await roomsGetallPaginated(skip, limitNum);
      if (!paginatedRooms) res.status(400).send(`room couldn't be found`);

      Logging.info(paginatedRooms);
      res.status(200).json(paginatedRooms);
    } catch (err: any) {
      new HttpException(401, err.message);
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
      Logging.log(`Longitude: ${lng}, Latitude: ${ltd}`);
      if (!userId) res.status(400).send("User Id is required");
      if (!lng && !ltd) res.status(400).send("Location is needed");
      if (!page) res.status(400).send("Page is needed");
      if (!limit) res.status(400).send("Limit is needed");

      const limitNum = Number(limit);
      const pageNum = Number(page);
      // Calculate the number of documents to skip
      const skip = (pageNum - 1) * limitNum;

      const nearByRooms = await roomsNearByPaginated(
        userId,
        Number(lng),
        Number(ltd),
        skip,
        limitNum
      );
      if (!nearByRooms) res.status(400).send(`room couldn't be found`);

      Logging.info(nearByRooms);
      res.status(201).json(nearByRooms);
    } catch (err: any) {
      new HttpException(401, err.message);
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

      Logging.log(req.files);
      if (!req.files) res.status(400).send({ message: "No files uploaded" });
      if (!fileType) res.status(400).send({ message: "No file type" });

      const { flyer, venue, venueVerification } = req.files as {
        flyer?: UploadedFile;
        venue?: UploadedFile[];
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
        case FileType.venue:
          await Promise.all(
            venue?.forEach(async (file: UploadedFile, index: number) => {
              let venueFileName = generateFilename(
                fileType,
                venue[index].name as string,
                roomId
              );
              let venueCommand = getPutObjectCommand(
                fileType,
                venueFileName,
                venue[index].mimetype,
                venue[index].data
              );
              await uploadRoomImage(venueCommand as PutObjectCommand);
              await addVenueImage(roomId, venueFileName);
            }) || []
          ).then((res) => {
            Logging.log(res);
          });

          const returnUrl = await getIMG(roomId, fileType);
          res.status(201).send({ returnUrl });
          break;
        case FileType.venueVerification:
          let venueVerificationFileName = generateFilename(
            fileType,
            flyer?.name as string,
            roomId
          );
          const venueVerificationCommand = getPutObjectCommand(
            fileType,
            venueVerificationFileName,
            venueVerification?.mimetype as string,
            venueVerification?.data as Buffer
          );
          await uploadRoomImage(venueVerificationCommand as PutObjectCommand);
          await addFlyerIMG(roomId, venueVerificationFileName);
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
        res.status(400).send("Id is required");

      const user_Id = new toId(addedguest as string);
      const room_Id = new toId(roomId);

      const addedGuest = await addSpecialGuest(userId, {
        userId: user_Id,
        roomId: room_Id,
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
        res.status(400).send("Id is required");

      const addedGuest = await addSponsor(userId, roomId, req.body);

      if (!addedGuest) res.status(400).send({ message: "Sponsor not added" });

      res.status(201).send(addedGuest);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default RoomController;
