import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";
import { UploadedFile } from "express-fileupload";
import c from "config";
import { checkImageUrl } from "./helperFunc.ts/checkImgUrlExpiration";
import { IPostDocument } from "../../resources/post/post.interface";
import { updatePostMedia } from "../../resources/post/post.service";
import { getUserIMG } from "../../resources/user/user.service";

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

const BUCKET_NAME = validateEnv.AWS_BLU_POSTS_MEDIA;

export const generateMediaFileName = (
  fileType: string,
  originalName: string,
  userId: string,
  postId: string
): string => {
  const timestamp = Date.now();
  const randomString = Math.floor(Math.random() * 10000).toString();
  const extension = originalName.split(".").pop();
  return `post-media/${fileType}/${userId}/${postId}/${timestamp}-${randomString}.${extension}`;
};

export const uploadMediaFile = async (
  file: UploadedFile,
  mediaType: MediaType,
  userId: string,
  postId: string
): Promise<string[]> => {
  try {
    const fileName = generateMediaFileName(
      mediaType,
      file.name,
      userId,
      postId
    );

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
      Metadata: {
        userId: userId.toString(),
        postId: postId.toString(),
        mediaType: mediaType.toString(),
      },
    });
    Logging.log(`command: ${JSON.stringify(command)}`);
    await mediaS3.send(command);

    const signedUrl = await getMediaSignedUrl(fileName, 3600); // 1 hour expiry

    return [signedUrl, fileName];
  } catch (error) {
    Logging.error(`Error uploading media file: ${error}`);
    throw new Error(`Failed to upload media file: ${error}`);
  }
};

export const getMediaSignedUrl = async (
  s3Key: string,
  expiresIn: number = 8400
): Promise<string> => {
  try {
    Logging.log(`s3Key: ${s3Key}`);
    if (undefined === s3Key || !s3Key.includes("media"))
      return "s3Key is invalid";

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
  Logging.log(`getMediaTypeFromMimeType: ${mimeType}`);
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

export const listCheckImgUrlWithUser = async (posts: IPostDocument[]) => {
  try {
    var foundPostMedia = [];
    for (const post of posts) {
      const media = post.content.url;
      const name = post.content.name;
      if (!media || name === undefined || !name.startsWith("post-media"))
        continue;
      Logging.log(`media: ${media} name: ${post.content.name}`);
      const isValid = checkImageUrl(media);
      if (!isValid) {
        const url = await getMediaSignedUrl(post.content.name, 3600); // 1 hour expiry

        const updatedPost = await updatePostMedia(
          post._id,
          url,
          post.content.name
        );
        Logging.log(updatedPost);

        const userId = updatedPost?.user_Id?._id.toString() as string;

        const userIMGURL = await getUserIMG(userId);

        foundPostMedia.push({
          ...updatedPost?.toObject(),
          userImage: userIMGURL,
        });
      }

      const userIMGURL = await getUserIMG(
        post?.user_Id?._id.toString() as string
      );

      foundPostMedia.push({ ...post.toObject(), userImage: userIMGURL });
    }
    return foundPostMedia;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const listCheckImageUrl = async (posts: IPostDocument[]) => {
  try {
    var foundPostMedia = [];
    for (const post of posts) {
      const media = post.content.url;
      if (!media) continue;
      const isValid = checkImageUrl(media);
      if (!isValid) {
        const url = await getMediaSignedUrl(post.content.name);

        const updatedPost = await updatePostMedia(
          post._id,
          url,
          post.content.name
        );

        foundPostMedia.push(updatedPost);
      } else {
        foundPostMedia.push(post);
      }
    }
    return foundPostMedia;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const validateMediaFile = (
  file: UploadedFile,
  maxSizeInMB: number = 300
): void => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  Logging.log(`validateMediaFile: ${file.size}`);
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
