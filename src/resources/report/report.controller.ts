import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import HttpException from "../../middleware/exceptions/http.exception";
import {
  createReport,
  deleteReport,
  getReport,
  updateReport,
} from "./report.service";
import { RequiredAuth } from "middleware/auth.middleware";
import ValidationMiddleware from "middleware/val.middleware";
import { createReporting, updateReporting } from "./report.validation";

class ReportController implements Controller {
  public path = "/report";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(`${this.path}/:reportId`, RequiredAuth, this.getReport);
    this.router.patch(
      `${this.path}/:reportId`,
      RequiredAuth,
      ValidationMiddleware(updateReporting),
      this.updateReport
    );
    this.router.delete(
      `${this.path}/:reportId`,
      RequiredAuth,
      this.deleteReport
    );
    this.router.post(
      `${this.path}`,
      RequiredAuth,
      ValidationMiddleware(createReporting),
      this.createReport
    );
  }

  private getReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { reportId } = req.params;
      if (!reportId) res.status(400).send("Report Id is required");

      const foundReport = await getReport(reportId);
      if (!foundReport) res.status(400).send("Report not found");

      res.status(200).send(foundReport);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private updateReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { reportId } = req.params;
      if (!reportId) res.status(400).send("Report Id is required");

      const updatedReport = await updateReport(req.body);
      if (!updatedReport) res.status(400).send("Report not updated");

      res.status(201).send(updatedReport);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private deleteReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { reportId } = req.params;
      if (!reportId) res.status(400).send("Report Id is required");

      const deletedReport = await deleteReport(reportId);
      if (!deletedReport) res.status(400).send("Report not deleted");

      res.status(200).send(deletedReport);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private createReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const createdReport = await createReport(req.body);
      if (!createdReport) res.status(400).send("Report not created");

      res.status(201).send(createdReport);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default ReportController;
