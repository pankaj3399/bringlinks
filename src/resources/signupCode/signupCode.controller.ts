import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import HttpException from "../../middleware/exceptions/http.exception";
import {
  generateSignupCode,
  validateAndUseSignupCode,
  getSignupCodesByAdmin,
  getAllActiveSignupCodes,
  updateSignupCode,
  deactivateSignupCode,
} from "./signupCode.service";
import validationMiddleware from "../../middleware/val.middleware";
import validate from "./signupCode.validation";
import { RequiredAuth, AuthorizeRole } from "../../middleware/auth.middleware";
import { IRoles } from "../user/user.interface";
import EmailService from "../../utils/email/email.service";
import Logging from "../../library/logging";

class SignupCodeController implements Controller {
  public path = "/signup-codes";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/request`,
      validationMiddleware(validate.requestCode),
      this.requestSignupCode
    );

    this.router.post(
      `${this.path}/request/send/:adminId`,
      AuthorizeRole(IRoles.ADMIN),
      validationMiddleware(validate.sendSignupCodeRequestEmail),
      this.sendSignupCodeRequestEmail
    );

    this.router.post(
      `${this.path}/generate`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      validationMiddleware(validate.generateCode),
      this.generateCode
    );

    this.router.post(
      `${this.path}/validate`,
      validationMiddleware(validate.validateCode),
      this.validateCode
    );

    this.router.get(
      `${this.path}/my-codes`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      this.getMySignupCodes
    );

    this.router.get(
      `${this.path}/all`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      this.getAllActiveCodes
    );

    this.router.put(
      `${this.path}/:codeId`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      validationMiddleware(validate.updateCode),
      this.updateCode
    );

    this.router.delete(
      `${this.path}/:codeId`,
      RequiredAuth,
      AuthorizeRole(IRoles.ADMIN),
      this.deactivateCode
    );
  }

  private requestSignupCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      // if (!req.user?._id) {
      //   return res.status(401).json({ message: "Unauthorized" });
      // }

      const { name, message, email } = req.body;
      // const userEmail = (req.user as any)?.email as string | undefined;
      // const derivedName =
      //   (req.user as any)?.username ||
      //   (req.user as any)?.profile?.name ||
      //   nameFromBody;

      await EmailService.sendAdminSignupCodeRequest({
        name,
        email,
        message,
      });

      return res.status(200).json({
        message: "Your request has been received. We'll contact you soon.",
      });
    } catch (err: any) {
      Logging.error(`Error sending signup code request: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private generateCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { maxUsages, expiresAt } = req.body;
      const adminId = req.user._id as string;

      const signupCode = await generateSignupCode(
        adminId,
        maxUsages,
        expiresAt
      );

      if (!signupCode) {
        return res
          .status(400)
          .json({ message: "Failed to generate signup code" });
      }

      res.status(201).json({
        message: "Signup code generated successfully",
        code: signupCode,
      });
    } catch (err: any) {
      Logging.error(`Error generating signup code: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private validateCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { code } = req.body;

      const isValid = await validateAndUseSignupCode(code);

      if (!isValid) {
        return res.status(400).json({
          message: "Invalid or expired signup code",
        });
      }

      res.status(200).json({
        message: "Signup code is valid",
        valid: true,
      });
    } catch (err: any) {
      Logging.error(`Error validating signup code: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private getMySignupCodes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const adminId = req.user._id as string;
      const signupCodes = await getSignupCodesByAdmin(adminId);

      res.status(200).json({
        message: "Signup codes fetched successfully",
        codes: signupCodes,
      });
    } catch (err: any) {
      Logging.error(`Error fetching signup codes: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private getAllActiveCodes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const signupCodes = await getAllActiveSignupCodes();

      res.status(200).json({
        message: "All active signup codes retrieved successfully",
        codes: signupCodes,
      });
    } catch (err: any) {
      Logging.error(`Error fetching all active signup codes: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private updateCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { codeId } = req.params;
      const adminId = req.user._id as string;
      const updates = req.body;

      if (!codeId) {
        return res.status(400).json({ message: "Code ID is required" });
      }

      const updatedCode = await updateSignupCode(codeId, adminId, updates);

      if (!updatedCode) {
        return res.status(404).json({
          message:
            "Signup code not found or you're not authorized to update it",
        });
      }

      res.status(200).json({
        message: "Signup code updated successfully",
        code: updatedCode,
      });
    } catch (err: any) {
      Logging.error(`Error updating signup code: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };

  private deactivateCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { codeId } = req.params;
      const adminId = req.user._id as string;

      if (!codeId) {
        return res.status(400).json({ message: "Code ID is required" });
      }

      const success = await deactivateSignupCode(codeId, adminId);

      if (!success) {
        return res.status(404).json({
          message:
            "Signup code not found or you're not authorized to deactivate it",
        });
      }

      res.status(200).json({
        message: "Signup code deactivated successfully",
      });
    } catch (err: any) {
      Logging.error(`Error deactivating signup code: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };
  private sendSignupCodeRequestEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { name, message, email, code, status } = req.body;

      await EmailService.replyToSignupCodeRequestEmail({
        name,
        email,
        status,
        message,
        code,
      });

      return res
        .status(200)
        .json({ message: "Signup code request email sent" });
    } catch (err: any) {
      Logging.error(`Error sending signup code request email: ${err.message}`);
      return next(new HttpException(400, err.message));
    }
  };
}

export default SignupCodeController;
