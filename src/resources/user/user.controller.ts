import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import HttpException from "../../middleware/exceptions/http.exception";
import {
  registerUser,
  loginUser,
  deleteUser,
  updatePassword,
  followerAUser,
  unfollowAUser,
  getUserIMG,
  deleteIMG,
  addAviIMG,
  refreshTokenUser,
  getUserById,
  getUserUsername,
  clearRefreshToken,
  getSchedule,
  updateUserPreferences,
  getUserRecommendRooms,
  updateUser,
  requestPassword,
  getReceipts,
} from "./user.service";
import { registerAdmin } from "./admin/admin.service";
import config from "config";
import Logging from "../../library/logging";
import validationMiddleware from "../../middleware/val.middleware";
import validate from "./user.validation";
import adminValidation from "./admin/admin.validation";
import {
  isUserAccount,
  isUserRefreshToken,
} from "../../middleware/authorization.middleware";
import { ImageNAME } from "../../utils/ImageServices/helperFunc.ts/room.Img";
import { validateEnv } from "../../../config/validateEnv";
import { Secret } from "jsonwebtoken";
import { AuthorizeRole, RequiredAuth } from "../../middleware/auth.middleware";
import { IRoles, IUsers } from "./user.interface";
import { putS3Object } from "../../utils/ImageServices/user.Img";
import { UploadedFile } from "express-fileupload";
import { checkImageUrl } from "../../utils/ImageServices/helperFunc.ts/checkImgUrlExpiration";
import { getCreatorIMG } from "../room/room.service";
import { retrieveRoomIMG } from "../../utils/ImageServices/roomFlyer.Img";
import { PaymentStatus } from "../room/receipts/receipts.interface";
const imgName = ImageNAME();

class UserController implements Controller {
  public path = "/users";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/register`,
      validationMiddleware(validate.create),
      this.register
    );
    this.router.post(
      `${this.path}/request/password`,
      validationMiddleware(validate.requestPasswordChange),
      this.requestPasswordChange
    );
    this.router.post(
      `${this.path}/register-admin`,
      validationMiddleware(adminValidation.registerAdmin),
      this.registerAdmin
    );
    this.router.post(
      `${this.path}/login`,
      validationMiddleware(validate.loginUser),
      this.login
    );
    this.router.post(
      `${this.path}/update/:userId`,
      RequiredAuth,
      isUserAccount,
      this.updateUser
    );
    this.router.get(`${this.path}/:userId`, RequiredAuth, this.getUserById);
    this.router.get(
      `${this.path}/username/:username`,
      RequiredAuth,
      this.getUserByUsername
    );
    this.router.put(
      `${this.path}/userpreferences/:userId`,
      validationMiddleware(validate.userPreferences),
      RequiredAuth,
      this.updateUserPreferences
    );
    this.router.post(
      `${this.path}/refreshToken/:userId`,
      RequiredAuth,
      this.refreshToken
    );
    this.router.get(
      `${this.path}/schedule/:userId`,
      RequiredAuth,
      this.getSchedule
    );
    this.router.patch(
      `${this.path}/updatepassword/:refreshToken`,
      validationMiddleware(validate.changePassword),
      isUserRefreshToken,
      this.changePassword
    );
    this.router.delete(
      `${this.path}/deactivate/:userId`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      // isUserAccount,
      this.deactivateUser
    );
    this.router.get(`${this.path}/logout/:userId`, RequiredAuth, this.logout);
    this.router.post(
      `${this.path}/follow/:followerId/:userId`,
      RequiredAuth,
      isUserAccount,
      this.followAUser
    );
    this.router.post(
      `${this.path}/unfollow/:followerId/:userId`,
      RequiredAuth,
      isUserAccount,
      this.unFollowerAUser
    );
    this.router.put(
      `${this.path}/image/:userId`,
      RequiredAuth,
      isUserAccount,
      this.uploadIMG
    );
    this.router.get(
      `${this.path}/image/:userId`,
      RequiredAuth,
      isUserAccount,
      this.retrieveImg
    );
    this.router.delete(
      `${this.path}/image/:userId`,
      RequiredAuth,
      isUserAccount,
      this.deleteAviPhoto
    );
    this.router.get(
      `${this.path}/rooms/recommended/:userId`,
      RequiredAuth,
      isUserAccount,
      this.getRecommendedRooms
    );
    this.router.get(
      `${this.path}/receipts/:userId`,
      RequiredAuth,
      isUserAccount,
      this.getReceipts
    );
  }
  private getReceipts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { page, perPage, roomId, ticketId, status, paidRoomId } = req.query;

      if (!userId) return res.status(400).send("User ID is required");

      const receipts = await getReceipts(
        userId,
        Number(page),
        Number(perPage),
        roomId as string | undefined,
        paidRoomId as string | undefined,
        ticketId as string | undefined,
        status as PaymentStatus | undefined
      );

      if (!receipts)
        return res.status(400).json({ message: "No receipts found" });
      res.status(200).json(receipts);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const [createdUser, token] = await registerUser(
        req.body as unknown as Partial<IUsers>
      );

      res.cookie(validateEnv.COOKIE, token);
      res.status(201).send({ createdUser, token });
    } catch (err: any) {
      return next(new HttpException(400, err));
    }
  };

  private registerAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const [createdAdmin, token] = await registerAdmin(req.body);

      res.cookie(validateEnv.COOKIE, token);
      res.status(201).send({
        createdAdmin,
        token,
        message: "Admin created successfully",
      });
    } catch (err: any) {
      return next(new HttpException(400, err));
    }
  };
  private requestPasswordChange = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      Logging.log(req.body);

      await requestPassword(req.body);

      res.status(200).send("Email Sent");
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const [foundUser, token] = await loginUser(req.body);

      if (!foundUser || !token)
        return res.status(400).json({ message: "User not found" });

      res.cookie(validateEnv.COOKIE, token);
      res.status(200).json({ foundUser, token });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const updatedUser = await updateUser(req.body, userId);

      if (!updatedUser)
        return res.status(400).json({ message: "User not updated" });

      res.status(201).json(updatedUser);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private updateUserPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const foundUser = await getUserById(userId);
      if (!foundUser)
        return res.status(400).json({ message: "User not found" });

      const updatedUser = await updateUserPreferences(userId, req.body);

      if (!updatedUser)
        return res.status(400).json({ message: "User not updated" });

      res.status(200).json(updatedUser);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const foundUser = await getUserById(userId);
      if (!foundUser)
        return res.status(400).json({ message: "User not found" });

      res.status(200).json(foundUser);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private getUserByUsername = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { username } = req.params;
      if (!username) return res.status(400).send("Username is required");

      const foundUser = await getUserUsername(username);
      if (!foundUser)
        return res.status(400).json({ message: "User not found" });

      res.status(200).json(foundUser);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { refreshToken } = req.body.token;
      const { userId } = req.params;
      if (!refreshToken)
        return res.status(400).send("Refresh token is required");

      const { newToken, freshToken }: Secret[] | any = await refreshTokenUser(
        refreshToken,
        userId
      );

      if (!newToken || !freshToken)
        return res.status(400).json({ message: "Error No token was created" });

      res.cookie(validateEnv.COOKIE, newToken);
      res.status(201).json({ token: newToken, refreshToken: freshToken });
    } catch (err: any) {
      Logging.error(err.message);
      return next(new HttpException(400, err.message));
    }
  };
  private logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id)
        return res.status(401).json({ message: "Unauthorized" });
      const user = await clearRefreshToken(req.user._id as string);

      if (!user)
        return res.status(400).json({ message: "User not logged out" });

      res.clearCookie(validateEnv.COOKIE);
      res.status(200).send({ message: "Logged out successfully", user });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private getSchedule = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");
      const foundSchedule = await getSchedule(userId);
      if (!foundSchedule)
        return res.status(400).json({ message: "Schedule not found" });

      Logging.info(foundSchedule);
      res.status(200).json(foundSchedule);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private deactivateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const deletedUser = await deleteUser(userId);
      if (!deletedUser)
        return res.status(400).json({ message: "Error deactivating User" });

      Logging.info(deletedUser.collection);
      res.clearCookie(config.get<string>("cookie"));
      res.status(200).send(deletedUser._id);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id)
        return res.status(401).json({ message: "Unauthorized" });
      if (!req.body.auth.password)
        return res.status(400).json({ message: "Password is required" });

      const user = await updatePassword(
        req.body.auth.password,
        req.user._id as string
      );
      Logging.log(user);
      if (!user)
        return res.status(400).json({ message: "Error updating password" });

      //create new token
      const [token, refreshToken]: Secret[] = await refreshTokenUser(
        user.refreshToken,
        user._id
      );

      if (!token || !refreshToken)
        return res.status(400).json({ message: "Token not created" });

      res.status(200).send({ token, user });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private followAUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { followerId, userId } = req.params;
      if (!followerId || !userId) return res.status(400).send("Id is required");
      const followed = await followerAUser(userId, followerId);

      if (!followed)
        return res
          .status(400)
          .json({ message: "User not able to be followed, try again" });
      res.status(200).json(followed);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private unFollowerAUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { followerId, userId } = req.params;
      if (!followerId || !userId) return res.status(400).send("Id is required");

      const followed = await unfollowAUser(userId, followerId);

      if (followed < 0)
        return res
          .status(400)
          .json({ message: "User not able to be unfollowed, try again" });
      res.status(200).json(followed);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private uploadIMG = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { fileType } = req.query;

      if (!userId) return res.status(400).send("UserId is required");
      if (!fileType) return res.status(400).send("File type is required");
      if (!req.files) return res.status(400).send("File is required");
      if (!req.files.image)
        return res.status(400).send("Image file is required");

      const { name, data, mimetype } = req.files.image as UploadedFile;
      const fileName = `${userId}/${fileType}/${imgName}-${Date.now()}${name}`;

      const putImage = await putS3Object(data, fileName, mimetype);
      if (!putImage)
        return res.status(400).json({ message: "Image not found" });

      const updatedUser = await addAviIMG(userId, fileName);
      if (!updatedUser)
        return res.status(400).json({ message: "Image added to user" });

      const signedUrl = await getUserIMG(userId);

      if (!signedUrl)
        return res.status(400).json({ message: "Image not found" });

      res.status(201).send({ signedUrl });
    } catch (err: any) {
      Logging.error(`uploadIMG failed | error=${String(err?.message || err)}`);
      if (err?.stack) Logging.error(err.stack);
      const msg =
        typeof err === "string" ? err : err?.message || "Upload failed";
      next(new HttpException(400, msg));
    }
  };
  private retrieveImg = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");

      const foundImage = await getUserIMG(userId);

      if (!foundImage)
        return res.status(400).json({ message: "Image not found" });

      const isValid = checkImageUrl(foundImage);

      if (!isValid) {
        const url = await getUserIMG(userId);
        if (!url) return res.status(400).json({ message: "Image not found" });
        return res.status(200).send({ newUrl: url });
      }
      return res.status(200).send({ foundUrl: foundImage });
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message;
      next(new HttpException(400, msg));
    }
  };
  private deleteAviPhoto = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");
      const deleted = await deleteIMG(userId);

      if (!deleted) return res.status(400).json({ message: "Image not found" });

      res.status(200).send({ success: true });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getRecommendedRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      let recommendedRoomsWithCreatorIMG: any = [];
      const { userId } = req.params;
      const { page, perPage } = req.query;
      if (!userId) return res.status(400).send("Id is required");

      const recommendedRooms = await getUserRecommendRooms(
        userId,
        Number(page),
        Number(perPage)
      );

      if (!recommendedRooms)
        return res.status(400).json({ message: "No recommend rooms found" });

      await Promise.all(
        recommendedRooms.map(async (room) => {
          let roomFlyerIMG;
          const creatorIMG = await getCreatorIMG(room._id);
          roomFlyerIMG = await retrieveRoomIMG(room.event_flyer_img.name);
          recommendedRoomsWithCreatorIMG.push({
            ...room,
            freshCreatorIMG: creatorIMG,
            roomFlyerIMG,
          });
        })
      );

      Logging.info(recommendedRoomsWithCreatorIMG);
      res.status(200).json(recommendedRoomsWithCreatorIMG);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
}

export default UserController;
