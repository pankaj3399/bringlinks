import { Router, Request, Response, NextFunction } from "express";
import {
  RequiredAuth,
  RequiredWalletAuth,
} from "../../middleware/auth.middleware";
import jwt from "../../utils/authentication/jwt.createtoken";
import {
  isUserAccount,
  walletPermissions,
} from "../../middleware/authorization.middleware";
import Controller from "utils/interfaces/controller.interface";
import {
  createWallet,
  deleteWallet,
  getWalletById,
  updateWallet,
} from "./wallet.service";
import validate from "./wallet.validation";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import validationMiddleware from "../../middleware/val.middleware";

class WalletController implements Controller {
  public path = "/wallet";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/:userId/:walletId`,
      RequiredAuth,
      RequiredWalletAuth,
      isUserAccount,
      walletPermissions,
      this.getWalletById
    );
    this.router.post(
      `${this.path}/:userId`,
      RequiredAuth,
      isUserAccount,
      validationMiddleware(validate.createWallet),
      this.createWallet
    );
    this.router.patch(
      `${this.path}/:userId/:walletId`,
      RequiredAuth,
      RequiredWalletAuth,
      isUserAccount,
      walletPermissions,
      validationMiddleware(validate.updateWallet),
      this.updateWallet
    );
    this.router.delete(
      `${this.path}/:userId/:walletId`,
      RequiredAuth,
      RequiredWalletAuth,
      isUserAccount,
      walletPermissions,
      this.deleteWallet
    );
  }

  private createWallet = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) res.status(400).send("Id is required");

      const userWithWallet = await createWallet(req.body, userId);
      if (!userWithWallet) res.status(400).send("Wallet not created");

      //create token
      const [token, refreshToken] = jwt.CreateToken({
        userId: userId,
        role: req.user?.role,
        name:
          userWithWallet.firstName +
          "," +
          userWithWallet.lastName,
        email: userWithWallet.email,
      });

      if (!token || !refreshToken)
        return res.status(400).json({ message: "Token not created" });

      Logging.info(userWithWallet);
      res.status(201).send(userWithWallet);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getWalletById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { walletId } = req.params;
      if (!walletId) res.status(400).send("Id is required");

      const foundWallet = await getWalletById(walletId);
      if (!foundWallet) res.status(400).send("Wallet not found");

      Logging.info(foundWallet);
      res.status(200).send(foundWallet);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private updateWallet = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { walletId } = req.params;
      if (!walletId) res.status(400).send("Id is required");

      const updatedWallet = await updateWallet(walletId, req.body);
      if (!updatedWallet) res.status(400).send("Wallet not updated");

      Logging.info(updatedWallet);
      res.status(201).send(updatedWallet);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private deleteWallet = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId, walletId } = req.params;

      const wallet = await deleteWallet(walletId, userId);
      if (!wallet) res.status(400).send("Wallet not deleted");

      res.status(200).send("Wallet deleted");
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default WalletController;
