import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
import Logging from "../../library/logging";
import { s3 } from "./helperFunc.ts/room.Img";
import { validateEnv } from "../../../config/validateEnv";
import { IPostDocument } from "../../resources/post/post.interface";
import { updatePostMedia } from "../../resources/post/post.service";
import { checkImageUrl } from "./helperFunc.ts/checkImgUrlExpiration";
import { getUserIMG } from "../../resources/user/user.service";
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

export const listCheckRoomImgUrl = async (posts: IPostDocument[]) => {
  try {
    var foundPostMedia = [];
    for (const post of posts) {
      const media = post.content.url;
      if (!media) {
        Logging.log(`media: ${media} name: ${post.content.name}`);
        const url = await retrieveRoomIMG(post.content.name);
        Logging.log(url);
        const updatedPost = await updatePostMedia(
          post._id,
          url,
          post.content.name
        );

        const userId = updatedPost?.user_Id?._id.toString() as string;

        const userIMGURL = await getUserIMG(userId);

        foundPostMedia.push({
          ...updatedPost?.toObject(),
          userImage: userIMGURL,
        });
      }

      const isValid = checkImageUrl(media);
      if (!isValid) {
        const url = await retrieveRoomIMG(post.content.name);

        const updatedPost = await updatePostMedia(
          post._id,
          url,
          post.content.name
        );

        foundPostMedia.push(updatedPost);
      }
      const userId = post?.user_Id?._id.toString() as string;

      const userIMGURL = await getUserIMG(userId);

      foundPostMedia.push({
        ...post?.toObject(),
        userImage: userIMGURL,
      });
    }
    return foundPostMedia;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};
