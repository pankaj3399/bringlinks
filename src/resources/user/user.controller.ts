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
  getIMG,
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
} from "./user.service";
import config from "config";
import Logging from "../../library/logging";
import validationMiddleware from "../../middleware/val.middleware";
import validate from "./user.validation";
import RedisClientMiddleware from "../../middleware/redis.middleware";
import { isUserAccount } from "../../middleware/authorization.middleware";
import { ImageNAME } from "../../utils/ImageServices/helperFunc.ts/room.Img";
import { validateEnv } from "../../../config/validateEnv";
import { Secret } from "jsonwebtoken";
import { AuthorizeRole, RequiredAuth } from "../../middleware/auth.middleware";
import { IRoles } from "./user.interface";
import { putS3Object } from "../../utils/ImageServices/user.Img";
import { UploadedFile } from "express-fileupload";
import fileUpload from "express-fileupload";
import { checkImageUrl } from "../../utils/ImageServices/helperFunc.ts/checkImgUrlExpiration";
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
      `${this.path}/updatepassword/:userId`,
      validationMiddleware(validate.changePassword),
      RequiredAuth,
      isUserAccount,
      this.changePassword
    );
    this.router.delete(
      `${this.path}/deactivate/:userId`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      isUserAccount,
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
      `${this.path}/recommendedRooms/:userId`,
      RequiredAuth,
      isUserAccount,
      this.getRecommendedRooms
    );
  }
  private register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const [createdUser, token, refreshToken] = await registerUser(req.body);

      res.cookie(validateEnv.COOKIE, token);
      res.status(201).send({ createdUser, token, refreshToken });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const [foundUser, token, refreshToken] = await loginUser(req.body);

      if (!foundUser || !token)
        return res.status(400).json({ message: "User not found" });

      res.cookie(validateEnv.COOKIE, token);
      res.status(200).json({ foundUser, token, refreshToken });
    } catch (err: any) {
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      if (!refreshToken) return res.status(400).send("Refresh token is required");

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
      next(new HttpException(400, err.message));
    }
  };
  private logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
      const user = await clearRefreshToken(req.user._id as string);

      if (!user)
        return res.status(400).json({ message: "User not logged out" });

      res.clearCookie(validateEnv.COOKIE);
      res.status(200).send({ message: "Logged out successfully", user });
    } catch (err: any) {
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
    }
  };

  private changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
      const user = await updatePassword(req.body, req.user._id as string);

      if (!user)
        return res.status(400).json({ message: "Error updating password" });

      res.status(200).send(req.body);
    } catch (err: any) {
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      next(new HttpException(400, err.message));
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
      if (!req.files.image) return res.status(400).send("Image file is required");

      const { name, data, mimetype } = req.files.image as UploadedFile;
      const fileName = `${userId}/${fileType}/${imgName}-${Date.now()}${name}`;

      const putImage = await putS3Object(data, fileName, mimetype);
      if (!putImage)
        return res.status(400).json({ message: "Image not found" });

      const updatedUser = await addAviIMG(userId, fileName);
      if (!updatedUser)
        return res.status(400).json({ message: "Image added to user" });

      const signedUrl = await getIMG(userId);

      if (!signedUrl)
        return res.status(400).json({ message: "Image not found" });

      res.status(201).send({ signedUrl });
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "Upload failed";
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

      const foundImage = await getIMG(userId);

      if (!foundImage)
        return res.status(400).json({ message: "Image not found" });

      const isValid = checkImageUrl(foundImage);

      if (!isValid) {
        const url = await getIMG(userId);
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
      const foundImage = await deleteIMG(userId);

      if (!foundImage)
        return res.status(400).json({ message: "Image not found" });

      res.status(200).send(foundImage);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
  private getRecommendedRooms = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).send("Id is required");
      //Redis Layer

      const recommendedRooms = await getUserRecommendRooms(userId);

      if (!recommendedRooms)
        return res.status(400).json({ message: "No recommend rooms found" });


      res.status(200).json(recommendedRooms);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default UserController;
