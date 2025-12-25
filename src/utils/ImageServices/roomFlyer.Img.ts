import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
import Logging from "../../library/logging";
import { s3 } from "./helperFunc.ts/room.Img";
import { validateEnv } from "../../../config/validateEnv";
const Bucket = `${validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER}`;

export const uploadRoomImage = async (command: PutObjectCommand) => {
  try {
    Logging.log(command);
    return await s3.send(command).catch((err) => {
      Logging.error(err);
      throw err.message;
    });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};
export const retrieveRoomIMG = async (imgName: string) => {
  try {
    Logging.log(imgName);
    const command = new GetObjectCommand({
      Bucket,
      Key: imgName,
    });

    return await getSignedUrl(s3, command, { expiresIn: 60000 });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};

export const deleteRoomFlyerIMG = async (imgName: string) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket,
      Key: imgName,
    });

    return await s3.send(command).catch((err) => {
      throw err.message;
    });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};
