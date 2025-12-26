import mongoose from "mongoose";
import { IReport } from "./report.interface";
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
  reportId: string,
  updates: Partial<
    Pick<
      IReport,
      | "userId"
      | "reportType"
      | "description"
      | "evidence"
      | "reportedTicketId"
      | "reportedRoomId"
      | "reportedUserId"
    >
  >
) => {
  try {
    const updatedReport = await Report.findByIdAndUpdate(
      { _id: reportId },
      { $set: updates },
      { new: true }
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

export const getAllReports = async (userId: string) => {
  try {
    const allReports = await Report.find({ userId: userId });
    if (!allReports) throw new Error("Reports not found");

    return allReports;
  } catch (err) {
    throw err;
  }
};
