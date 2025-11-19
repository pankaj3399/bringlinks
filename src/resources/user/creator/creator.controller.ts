import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../../utils/interfaces/controller.interface";
import HttpException from "../../../middleware/exceptions/http.exception";
import { RequiredAuth } from "../../../middleware/auth.middleware";
import { isUserAccount } from "../../../middleware/authorization.middleware";
import {
  signupAsCreator,
  registerCreator,
  getCreatorByUserId,
  getCreatorById,
  updateCreatorProfile,
  canCreatePaidRooms,
  initiateStripeConnectOnboarding,
  getStripeConnectStatus,
  completeStripeConnectOnboarding,
  getCreatorEarnings,
  getReviewsByCreatorId,
} from "./creator.service";
import validationMiddleware from "../../../middleware/val.middleware";
import validate from "./creator.validation";
import { invalidateCache, advancedCacheMiddleware } from "../../../middleware/cache.middleware";

class CreatorController implements Controller {
  public path = "/creator";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/signup`,
      validationMiddleware(validate.creatorSignup),
      this.signupAsCreator
    );

    this.router.post(
      `${this.path}/register/:userId`,
      RequiredAuth,
      isUserAccount,
      validationMiddleware(validate.creatorRegistration),
      this.registerCreator
    );

    this.router.get(
      `${this.path}/profile/:userId`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:profile:${req.params.userId}`,
        ttl: 1800
      }),
      this.getCreatorProfileByUserId
    );

    this.router.get(
      `${this.path}/profile/:creatorId`,
      RequiredAuth,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:reviews:${req.params.creatorId}`,
        ttl: 1800
      }),
      this.getCreatorReviews
    );

    this.router.put(
      `${this.path}/profile/:creatorId`,
      RequiredAuth,
      isUserAccount,
      invalidateCache('creator', 'creatorId'),
      this.updateCreatorProfile
    );

    this.router.get(
      `${this.path}/can-create-paid-rooms/:userId`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:cancreatepaidrooms:${req.params.userId}`,
        ttl: 1800
      }),
      this.checkPaidRoomEligibility
    );

    this.router.get(
      `${this.path}/earnings/:userId`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:earnings:${req.params.userId}`,
        ttl: 600
      }),
      this.getCreatorEarnings
    );

    this.router.post(
      `${this.path}/stripe-connect/onboard`,
      RequiredAuth,
      validationMiddleware(validate.stripeConnectOnboarding),
      this.initiateStripeConnect
    );

    this.router.get(
      `${this.path}/stripe-connect/status/:userId`,
      RequiredAuth,
      isUserAccount,
      advancedCacheMiddleware({
        keyBuilder: (req) => `cache:creator:stripe:status:${req.params.userId}`,
        ttl: 3600
      }),
      this.getStripeConnectStatus
    );

    this.router.post(
      `${this.path}/stripe-connect/complete/:userId`,
      RequiredAuth,
      isUserAccount,
      this.completeStripeConnect
    );
  }

  private signupAsCreator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const result = await signupAsCreator(req.body);
      res.status(201).json({
        success: true,
        message: "Creator signed up successfully",
        ...result,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private registerCreator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const creator = await registerCreator({ userId, ...req.body });
      res.status(201).json({
        success: true,
        message: "Creator registered successfully",
        creator,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getCreatorReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { creatorId } = req.params;

      if (!creatorId) {
        return res.status(401).json({ message: "Id is required" });
      }

      const reviews = await getReviewsByCreatorId(creatorId);
      res.status(200).json({
        success: true,
        message: "Creator reviews fetched successfully",
        reviews,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getCreatorProfileByUserId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const creator = await getCreatorByUserId(userId);
      if (!creator) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      res.status(200).json({ success: true, creator });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private updateCreatorProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { creatorId } = req.params;
      const updatedCreator = await updateCreatorProfile(creatorId, req.body);
      if (!updatedCreator) {
        return res
          .status(404)
          .json({ message: "Creator not found or update failed" });
      }
      res.status(200).json({
        success: true,
        message: "Creator profile updated successfully",
        creator: updatedCreator,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private checkPaidRoomEligibility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const eligibility = await canCreatePaidRooms(userId);
      res.status(200).json({ success: true, ...eligibility });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getCreatorEarnings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const earnings = await getCreatorEarnings(userId);
      res.status(200).json({ success: true, earnings });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private initiateStripeConnect = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { returnUrl, refreshUrl } = req.body;

      const stripeConnect = await initiateStripeConnectOnboarding(
        userId,
        returnUrl,
        refreshUrl
      );

      res.status(200).json({
        success: true,
        message: "Stripe Connect onboarding initiated",
        stripeConnect,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getStripeConnectStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const status = await getStripeConnectStatus(userId);
      res.status(200).json({ success: true, stripeConnect: status });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private completeStripeConnect = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const result = await completeStripeConnectOnboarding(userId);
      res.status(200).json({
        success: true,
        message: "Stripe Connect completed successfully",
        stripeConnect: result,
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default CreatorController;
