import mongoose from "mongoose";
import { IReport } from "./report.interface";
import { IMGNames, IRoomsDocument } from "../room/room.interface";
import { IUserDocument } from "../user/user.interface";
import Report from "./report.model";
var toId = mongoose.Types.ObjectId;

export const getReport = async (reportId: string) => {
  try {
    const foundReport = await Report.findById(reportId);
    if (!foundReport) throw new Error("Report not found");

    return foundReport;
  } catch (err) {
    throw err;
  }
};

export const updateReport = async (
  report: Pick<
    IReport,
    | "_id"
    | "userId"
    | "reportType"
    | "description"
    | "evidence"
    | "reportedTicketId"
    | "reportedRoomId"
    | "reportedUserId"
  >
) => {
  try {
    const updatedReport = await Report.findByIdAndUpdate(
      { _id: report._id },
      {
        $set: {
          report,
        },
      }
    ).catch((err) => {
      throw err;
    });

    return updatedReport;
  } catch (err) {
    throw err;
  }
};

export const deleteReport = async (reportId: string) => {
  try {
    const deletedReport = await Report.findByIdAndDelete(reportId);
    if (!deletedReport) throw new Error("Report not found");

    return deletedReport;
  } catch (err) {
    throw err;
  }
};

export const createReport = async (
  report: Pick<
    IReport,
    | "userId"
    | "reportType"
    | "description"
    | "evidence"
    | "reportedTicketId"
    | "reportedRoomId"
    | "reportedUserId"
  >
) => {
  try {
    const createdReport = await Report.create(report);
    if (!createdReport) throw new Error("Report not created");

    return createdReport;
  } catch (err) {
    throw err;
  }
};
