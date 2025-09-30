import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import validationMiddleware from "../../middleware/val.middleware";
import AuthValidation from "./auth.validation";
import AuthService from "./auth.service";
import passport from "passport";

class AuthController implements Controller {
  public path = "/auth";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/send-otp`,
      validationMiddleware(AuthValidation.sendOtp),
      this.sendOtp
    );
    this.router.post(
      `${this.path}/verify-otp`,
      validationMiddleware(AuthValidation.verifyOtp),
      this.verifyOtp
    );
    // this.router.post(
    //   `${this.path}/apple-signin`,
    //   validationMiddleware(AuthValidation.appleSignin),
    //   this.appleSignin
    // );

    this.router.get(
      `${this.path}/google`,
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    this.router.get(
      `${this.path}/google/callback`,
      passport.authenticate('google', { session: false, failureRedirect: '/auth/google' }),
      (req: Request, res: Response) => {
        const user: any = (req as any).user;
        const [accessToken, refreshToken] = require('../../utils/authentication/jwt.createtoken').default.CreateToken({
          _id: user._id,
          username: user.auth?.username,
          email: user.auth?.email,
        });
        return res.status(200).json({ success: true, accessToken, refreshToken, user });
      }
    );
  }

  private async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phoneNumber, state } = req.body as { phoneNumber: string; state: string };
      const result = await AuthService.sendOtp(phoneNumber, state);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phoneNumber, otp } = req.body as { phoneNumber: string; otp: string };
      const result = await AuthService.verifyOtp(phoneNumber, otp);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // private async appleSignin(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const { appleToken } = req.body as { appleToken: string };
  //     const result = await AuthService.appleSignin(appleToken);
  //     return res.status(200).json(result);
  //   } catch (error) {
  //     next(error);
  //   }
  // }
}

export default AuthController;





