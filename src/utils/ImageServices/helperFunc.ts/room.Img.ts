import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto";
import Logging from "../../../library/logging";
import { validateEnv } from "../../../../config/validateEnv";
import { UploadedFile } from "express-fileupload";

export const ImageNAME = (bytes = 24) => {
  return crypto.randomBytes(bytes).toString("hex");
};
export enum FileType {
  flyer = "flyer",
  media = "media",
  venue = "venue",
  venueVerification = "venueVerification",
}
export type IdNameTypes = {
  imgName: string;
};

export const s3 = new S3Client({
  region: `${validateEnv.AWS_BUCKET_REGION}`,
  credentials: {
    accessKeyId: `${validateEnv.AWS_ACCESS_KEY_ID}`,
    secretAccessKey: `${validateEnv.AWS_ACCESS_KEY_SECRET}`,
  },
});
export const roomS3: S3Client = new S3Client({
  region: `${validateEnv.AWS_BUCKET_ROOM_REGION}`,
  credentials: {
    accessKeyId: `${validateEnv.AWS_ACCESS_KEY_ID_ROOM_FLYER}`,
    secretAccessKey: `${validateEnv.AWS_KEY_SECRET_ROOM_FLYER}`,
  },
});

// function that returns a client based on the bucket name
export const getS3Client = (bucket: string) => {
  switch (bucket) {
    case validateEnv.AWS_AVI_BUCKET_NAME:
      return s3;
    case validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER:
      return roomS3;
    default:
      return s3;
  }
};

//function that returns the correct command based on the file type
export const getPutObjectCommand = (
  fileType: FileType,
  imgName: string,
  mimetype: string,
  data: Buffer
) => {
  var command: PutObjectCommand;
  switch (fileType) {
    case FileType.flyer:
      command = new PutObjectCommand({
        Bucket: validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER,
        Key: imgName,
        Body: data,
        ContentType: mimetype,
      });
      return command;
    case FileType.media:
      command = new PutObjectCommand({
        Bucket: validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER,
        Key: imgName,
        Body: data,
        ContentType: mimetype,
      });
      return command;
    case FileType.venue:
      command = new PutObjectCommand({
        Bucket: validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER,
        Key: imgName,
        Body: data,
        ContentType: mimetype,
      });
      return command;
    case FileType.venueVerification:
      command = new PutObjectCommand({
        Bucket: validateEnv.AWS_AVI_BUCKET_NAME_ROOM_FLYER,
        Key: imgName,
        Body: data,
        ContentType: mimetype,
      });
      return command;
    default:
      return new Error("Invalid file type");
  }
};

// Generate a filename
export const generateFilename = (
  fileType: FileType,
  imgName: string,
  roomId: string
) => `${roomId}/${fileType}/${ImageNAME()}-${Date.now()}${imgName}`;
