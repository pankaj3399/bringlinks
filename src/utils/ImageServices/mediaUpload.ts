import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import Logging from "../../library/logging";
import { validateEnv } from "../../../config/validateEnv";
import { UploadedFile } from "express-fileupload";
import { IMediaMessage } from "../../resources/chats/chats.interface";

export enum MediaType {
  image = "image",
  voice = "voice",
  video = "video",
}

export const mediaS3 = new S3Client({
  region: validateEnv.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: validateEnv.AWS_ACCESS_KEY_ID,
    secretAccessKey: validateEnv.AWS_ACCESS_KEY_SECRET,
  },
});

const BUCKET_NAME = validateEnv.AWS_BLU_CHATS_MEDIA;

export const generateMediaFileName = (
  fileType: MediaType,
  originalName: string,
  userId: string
): string => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString("hex");
  const extension = originalName.split(".").pop();
  return `chat-media/${fileType}/${userId}/${timestamp}-${randomString}.${extension}`;
};

export const uploadMediaFile = async (
  file: UploadedFile,
  mediaType: MediaType,
  userId: string
): Promise<IMediaMessage> => {
  try {
    const fileName = generateMediaFileName(mediaType, file.name, userId);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
      Metadata: {
        userId: userId,
        mediaType: mediaType,
        originalName: file.name,
      },
    });

    await mediaS3.send(command);

    const signedUrl = await getMediaSignedUrl(fileName, 3600); // 1 hour expiry

    const mediaMessage: IMediaMessage = {
      type: mediaType,
      url: signedUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    Logging.info(`Media file uploaded successfully: ${fileName}`);
    Logging.info(`Generated signed URL: ${signedUrl}`);
    return mediaMessage;
  } catch (error) {
    Logging.error(`Error uploading media file: ${error}`);
    throw new Error(`Failed to upload media file: ${error}`);
  }
};

export const getMediaSignedUrl = async (
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(mediaS3, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    Logging.error(`Error generating signed URL: ${error}`);
    throw new Error(`Failed to generate signed URL: ${error}`);
  }
};

export const deleteMediaFile = async (s3Key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await mediaS3.send(command);
    Logging.info(`Media file deleted successfully: ${s3Key}`);
  } catch (error) {
    Logging.error(`Error deleting media file: ${error}`);
    throw new Error(`Failed to delete media file: ${error}`);
  }
};

export const getMediaTypeFromMimeType = (mimeType: string): MediaType => {
  if (mimeType.startsWith("image/")) {
    return MediaType.image;
  } else if (mimeType.startsWith("audio/")) {
    return MediaType.voice;
  } else if (mimeType.startsWith("video/")) {
    return MediaType.video;
  } else {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }
};

export const validateMediaFile = (
  file: UploadedFile,
  maxSizeInMB: number = 50
): void => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  if (file.size > maxSizeInBytes) {
    throw new Error(
      `File size exceeds maximum allowed size of ${maxSizeInMB}MB`
    );
  }

  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedAudioTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/m4a",
  ];
  const allowedVideoTypes = [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/webm",
  ];

  const allAllowedTypes = [
    ...allowedImageTypes,
    ...allowedAudioTypes,
    ...allowedVideoTypes,
  ];

  if (!allAllowedTypes.includes(file.mimetype)) {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
};
