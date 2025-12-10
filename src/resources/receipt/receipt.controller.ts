import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import HttpException from "../../middleware/exceptions/http.exception";
import { RequiredAuth } from "../../middleware/auth.middleware";
import { isUserAccount } from "../../middleware/authorization.middleware";
import {
  getUserReceipts,
  getReceiptById,
  getRoomReceipts,
} from "./receipt.service";
import validate from "./receipt.validation";
import validationMiddleware from "../../middleware/val.middleware";

class ReceiptController implements Controller {
  public path = "/receipts";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/user/:userId`,
      RequiredAuth,
      isUserAccount,
      validationMiddleware(validate.getReceiptsQuery, "query"),
      this.getUserReceipts,
    );
    this.router.get(
      `${this.path}/:receiptId`,
      RequiredAuth,
      validationMiddleware(validate.getReceiptByIdParams, "params"),
      this.getReceiptById,
    );
    this.router.get(
      `${this.path}/room/:roomId`,
      RequiredAuth,
      isUserAccount,
      validationMiddleware(validate.getRoomReceiptsQuery, "query"),
      this.getRoomReceipts,
    );
  }

  private getUserReceipts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      const { userId: paramUserId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Ensure user can only access their own receipts
      if (String(userId) !== String(paramUserId)) {
        return res.status(403).json({
          message: "Forbidden: You can only access your own receipts",
        });
      }

      const result = await getUserReceipts(String(userId), page, limit);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getReceiptById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      const { receiptId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const receipt = await getReceiptById(receiptId, String(userId));

      return res.status(200).json({
        success: true,
        receipt,
      });
    } catch (err: any) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ message: err.message });
      }
      if (err.message.includes("Unauthorized")) {
        return res.status(403).json({ message: err.message });
      }
      return next(new HttpException(400, err.message));
    }
  };

  private getRoomReceipts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      const { roomId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await getRoomReceipts(
        String(roomId),
        String(userId),
        page,
        limit,
      );

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ message: err.message });
      }
      if (err.message.includes("Unauthorized")) {
        return res.status(403).json({ message: err.message });
      }
      return next(new HttpException(400, err.message));
    }
  };
}

export default ReceiptController;
