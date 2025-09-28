import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
//import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
//import {getSignedUrl, S3RequestPresigner} from "@aws-sdk/s3-request-presigner"
import Logging from "../../library/logging";
import { getS3Client, s3 } from "./helperFunc.ts/room.Img";
import { validateEnv } from "../../../config/validateEnv";
const Bucket = `${validateEnv.AWS_AVI_BUCKET_NAME}`;

export const putS3Object = async (
  file: Buffer,
  imageName: string,
  mimetype: string
) => {
  try {
    const s3 = getS3Client(Bucket);
    const command = new PutObjectCommand({
      Bucket,
      Key: imageName,
      Body: file,
      ContentType: mimetype,
    });
    return await s3.send(command).catch((err) => {
      Logging.error(err.message);
      throw err.message;
    });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};

export const retrieveIMG = async (imageName: string) => {
  try {
    const command = new GetObjectCommand({
      Bucket,
      Key: imageName,
    });

    return await getSignedUrl(s3, command, { expiresIn: 86400 });
  } catch (err: any) {
    Logging.error(err);
    throw err.message;
  }
};

export const deleteAviIMG = async (imgName: string) => {
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
