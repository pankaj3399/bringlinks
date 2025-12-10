import e, { Router, Request, Response, NextFunction } from "express";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import Controller from "utils/interfaces/controller.interface";
import {
  comment,
  commentReply,
  createAPost,
  deleteAPost,
  deleteComment,
  editComment,
  getAPostById,
  getCommentsPaginated,
  getCommentsReplyPaginated,
  getCommentsWithImages,
  getLikes,
  getNearbyPostsPaginated,
  getNearPost,
  getNearRoomPost,
  getRoomPost,
  getRoomPostPaginated,
  getUserPost,
  getUserPosts,
  likeAPost,
  unLikeAPost,
  updatePost,
  updatePostMedia,
  updatePostStats,
  updateViews,
} from "./post.service";
import {
  generatePostShareLinks,
  trackPostShare,
  trackPostShareClick,
  getPostShareAnalytics,
} from "./sharePost/postShare.service";
import { PostSharePlatform, PostShareType } from "./sharePost/postShare.model";
import validationMiddleware from "../../middleware/val.middleware";
import validate from "./post.validation";
import commentValidate from "../comments/comments.validation";
import { RequiredAuth } from "../../middleware/auth.middleware";
import mongoose from "mongoose";
import {
  commentPermissions,
  likePermissions,
  postPermissions,
} from "../../middleware/authorization.middleware";
import {
  listCheckImageUrl,
  getMediaTypeFromMimeType,
  uploadMediaFile,
  validateMediaFile,
  listCheckImgUrlWithUser,
} from "../../utils/ImageServices/postImages";
import { listCheckRoomImgUrl } from "../../utils/ImageServices/roomFlyer.Img";
import { get } from "config";
import { IComments } from "../comments/comments.interface";
import { IPostDocument } from "./post.interface";

class PostController implements Controller {
  public path = "/posts";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.get(`${this.path}/:postId/share-links`, this.getPostShareLinks);
    this.router.put(
      `${this.path}/:postId/stats`,
      validationMiddleware(validate.updatePostStats),
      RequiredAuth,
      this.updatePostStats
    );
    this.router.get(`${this.path}/:postId/stats/viewer`, this.addPostViewStats);
    this.router.post(`${this.path}/:postId/share`, this.trackPostShare);
    this.router.get(
      `${this.path}/:postId/share-analytics`,
      RequiredAuth,
      this.getPostShareAnalytics
    );
    this.router.get(
      `${this.path}/share/:platform/:encodedUrl`,
      this.handlePostShareClick
    );
    this.router.post(
      `${this.path}/:userid`,
      RequiredAuth,
      validationMiddleware(validate.createPost),
      this.createAPost
    );
    this.router.get(
      `${this.path}/nearpost/:userId`,
      RequiredAuth,
      this.getNearPost
    );
    this.router.get(`${this.path}/:userid/:postid`, RequiredAuth, this.getPost);
    this.router.delete(
      `${this.path}/deletepost/:userid/:postid`,
      RequiredAuth,
      postPermissions,
      this.deletePost
    );
    this.router.patch(
      `${this.path}/editpost/:userid/:postid`,
      validationMiddleware(validate.updatePost),
      RequiredAuth,
      postPermissions,
      this.editPost
    );
    this.router.post(`${this.path}/like/:userid/:postid`, this.likeAPost);
    this.router.post(
      `${this.path}/unliked/:userid/:postid/:likeid`,
      RequiredAuth,
      likePermissions,
      this.unLikeAPost
    );
    this.router.get(
      `${this.path}/likes/:userid/:postid`,
      RequiredAuth,
      this.getUserLikes
    );
    this.router.get(
      `${this.path}/comments/paginated/:userid/:postid`,
      RequiredAuth,
      this.getCommentsPaginated
    );
    this.router.get(
      `${this.path}/comments/paginated/:userid/:postid/:commentid/reply`,
      RequiredAuth,
      this.getCommentsReplyPaginated
    );
    this.router.post(
      `${this.path}/comment/:userid/:postid`,
      RequiredAuth,
      validationMiddleware(commentValidate.createComment),
      this.comment
    );
    this.router.post(
      `${this.path}/comment/:userid/:postid/:commentid/reply`,
      RequiredAuth,
      validationMiddleware(commentValidate.createComment),
      this.commentReply
    );
    this.router.patch(
      `${this.path}/editcomment/:userid/:postid/:commentid`,
      RequiredAuth,
      validationMiddleware(commentValidate.updateComment),
      commentPermissions,
      this.editAComment
    );
    this.router.delete(
      `${this.path}/comment/:userid/:postid/:commentid`,
      RequiredAuth,
      commentPermissions,
      this.deleteAComment
    );
    this.router.post(
      `${this.path}/upload-image/:userid/:postid`,
      RequiredAuth,
      this.uploadPostMedia
    );
    this.router.get(
      `${this.path}/user/all/:userid`,
      RequiredAuth,
      this.getUserPost
    );
    this.router.get(
      `${this.path}/images/user/:userid`,
      RequiredAuth,
      this.retrieveUserPostMedia
    );
    this.router.get(
      `${this.path}/images/retrieve/:userid`,
      RequiredAuth,
      this.retrieveNearbyPostMedia
    );
    this.router.get(
      `${this.path}/images/room/:roomid/:userid`,
      RequiredAuth,
      this.retrieveRoomPostMedia
    );
    this.router.get(
      `${this.path}/images/retrieve/room/:userid`,
      RequiredAuth,
      this.retrieveNearbyRoomPostMedia
    );
    this.router.get(
      `${this.path}/media/retrieve/room/:userid/:roomid`,
      RequiredAuth,
      this.retrieveOneRoomPostMedia
    );
  }
  private getNearPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      const { lng, ltd } = req.query;

      if (!userId) return res.status(400).json({ message: "Id is required" });
      if (lng == null || ltd == null)
        return res
          .status(400)
          .json({ message: "Location coordinates are needed" });

      const lngNum = Number(String(lng).replace(/\s+/g, ""));
      const ltdNum = Number(String(ltd).replace(/\s+/g, ""));
      if (!Number.isFinite(lngNum) || !Number.isFinite(ltdNum)) {
        return res
          .status(400)
          .json({ message: "Invalid location coordinates" });
      }

      const foundPost = await getNearPost(userId, lngNum, ltdNum);
      res.status(200).json(foundPost);
    } catch (err: any) {
      Logging.error(`Error in getNearPost controller: ${err}`);
      next(new HttpException(500, err.message));
    }
  };
  private getPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!userid || !postid)
        return res.status(400).json({ message: "Id is required" });
      const foundPost = await getAPostById(postid, userid);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      res.status(200).json(foundPost);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private addPostViewStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;
      if (!postId) return res.status(400).send("Id is required");

      const updatedPost = await updateViews(postId);

      if (!updatedPost)
        return res.status(400).json({ message: "Post not updated" });

      res.status(200).json(updatedPost);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private getUserPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid } = req.params;
      if (!userid) return res.status(400).json({ message: "Id is required" });
      Logging.log(`getUserPost: ${userid}`);
      const foundPost = await getUserPost(userid);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      res.status(200).json(foundPost);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private createAPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid } = req.params;
      if (!userid) return res.status(400).json({ message: "Id is required" });
      const { roomId } = req.query;

      // ensure user_Id is set on body for schema validation
      (req.body as any).user_Id = userid;
      const foundPost = await createAPost(
        req.body,
        userid,
        roomId as string | undefined
      );

      if (!foundPost)
        return res.status(400).json({ message: "Post not created" });

      res.status(201).json(foundPost);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private uploadPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      if (!req.files || !req.files.media) {
        throw new Error("No media file provided");
      }

      const mediaFile = req.files.media as any;
      if (!req.user?._id) throw new Error("Unauthorized");
      if (!req.params.postid) throw new Error("Post ID is required");

      const userId = req.user._id as string;
      //check if postId is valid
      const foundPost = await getUserPosts(userId, req.params.postid);
      if (!foundPost) throw new Error("Post not found");

      validateMediaFile(mediaFile);

      const mediaType = getMediaTypeFromMimeType(mediaFile.mimetype);

      const [signedUrl, fileName] = await uploadMediaFile(
        mediaFile,
        mediaType,
        userId,
        foundPost._id
      );

      await updatePostMedia(foundPost._id, signedUrl, fileName);

      res.status(200).json({ signedUrl, fileName });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private editPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!userid) return res.status(400).json({ message: "Id is required" });

      const updatedPost = await updatePost({
        content: req.body.content,
        user_Id: new mongoose.Types.ObjectId(userid),
        _id: postid,
      });

      if (!updatedPost)
        return res.status(400).json({ message: "Post not updated" });

      res.status(201).json(updatedPost);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
    }
  };
  private deletePost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!userid || !postid)
        return res.status(400).json({ message: "Id is required" });

      const deletedPost = await deleteAPost(userid, postid);

      if (!deletedPost)
        return res.status(400).json({ message: "Post not deleted" });
      res.status(200).json(req.body);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
    }
  };
  private likeAPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });
      const likedPost = await likeAPost(postid, userid);
      if (!likedPost)
        return res.status(400).json({ message: "Post not liked" });

      res.status(200).json(likedPost);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
    }
  };
  private updatePostStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;
      if (!postId) return res.status(400).send("Id is required");

      const updatedPost = await updatePostStats(
        postId,
        Number(req.body.stats.timeViewed)
      );

      if (!updatedPost)
        return res.status(400).json({ message: "Post not updated" });

      res.status(200).json(updatedPost);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(500, err));
    }
  };
  private unLikeAPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid, likeid } = req.params;
      if (!postid || !userid || !likeid)
        return res.status(400).json({ message: "Id is required" });
      const unlikedUser = await unLikeAPost(userid, postid, likeid);

      if (!unlikedUser)
        return res.status(400).json({ message: "Post not unliked" });
      res.status(200).json(unlikedUser);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(500, err));
    }
  };
  private commentReply = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid, commentid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });
      //check post exist
      const foundPost = await getAPostById(postid, userid);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      if (!commentid)
        return res.status(400).json({ message: "Comment id is required" });
      const comments = await commentReply(userid, commentid, req.body, postid);
      if (!comments)
        return res.status(400).json({ message: "Comment not created" });

      res.status(200).json(comments);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(500, err.message));
    }
  };
  private getCommentsReplyPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid, commentid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });

      const page = Number(req.query.page);
      const perPage = Number(req.query.perPage);

      if (!perPage)
        return res.status(400).json({ message: "Per page is required" });
      if (!page) return res.status(400).json({ message: "Page is required" });

      const comments = await getCommentsReplyPaginated(
        postid,
        commentid,
        page,
        perPage
      );

      if (!comments)
        return res.status(400).json({ message: "Comment not found" });

      res.status(200).json(comments);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(500, err));
    }
  };
  private getCommentsPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });

      const page = Number(req.query.page);
      const perPage = Number(req.query.perPage);

      if (!perPage)
        return res.status(400).json({ message: "Per page is required" });
      if (!page) return res.status(400).json({ message: "Page is required" });

      const comments = await getCommentsPaginated(postid, page, perPage);

      if (!comments)
        return res.status(400).json({ message: "Comment not found" });

      //given comments get all the comments user images
      const commentsWithImages = await getCommentsWithImages(
        comments as IPostDocument[]
      );
      res.status(200).json(commentsWithImages);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err));
    }
  };
  private comment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });

      const { roomId } = req.query;

      if (roomId) {
        const comments = await comment(
          userid,
          postid,
          req.body,
          roomId as string
        );

        if (!comments)
          return res.status(400).json({ message: "Comment not created" });

        res.status(200).json(comments);
      } else {
        const comments = await comment(userid, postid, req.body);
        if (!comments)
          return res.status(400).json({ message: "Comment not created" });
        res.status(200).json(comments);
      }
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private deleteAComment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postid, commentid } = req.params;
      if (!postid || !commentid)
        return res.status(400).json({ message: "Id is required" });

      const deletedComment = await deleteComment(postid, commentid);

      if (deletedComment?.modifiedCount === 0)
        return res.status(400).json({ message: "Comment not deleted" });

      res.status(200).send({ message: "Comment deleted" });
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private editAComment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid, commentid } = req.params;
      if (!postid || !userid || !commentid)
        return res.status(400).json({ message: "Id is required" });

      const editedComment = await editComment(req.body, postid, userid);

      if (!editedComment)
        return res.status(400).json({ message: "Comment not edited" });

      res.status(200).json(req.body);
    } catch (err: any) {
      Logging.error(err);
      return next(new HttpException(400, err.message));
    }
  };
  private getUserLikes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, postid } = req.params;
      if (!postid || !userid)
        return res.status(400).json({ message: "Id is required" });

      const likes = await getLikes(postid, userid);

      if (!likes) return res.status(204).json({ message: "Likes not found" });
      res.status(200).json(likes);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
    }
  };
  private getPostShareLinks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;
      const { shareType = PostShareType.POST_SHARE, userId } = req.query;

      if (!postId)
        return res.status(400).json({ message: "Post ID is required" });

      if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid post ID format" });
      }
      const shareLinks = await generatePostShareLinks(
        postId,
        shareType as PostShareType,
        userId as string
      );

      res.status(200).json({
        success: true,
        postId,
        shareType,
        shareLinks,
      });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private trackPostShare = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;
      const {
        platform,
        shareType = PostShareType.POST_SHARE,
        userId,
      } = req.body;

      if (!postId)
        return res.status(400).json({ message: "Post ID is required" });
      if (!platform)
        return res.status(400).json({ message: "Platform is required" });
      if (!userId)
        return res.status(400).json({ message: "User ID is required" });

      if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid post ID format" });
      }

      const result = await trackPostShare(
        postId,
        userId,
        platform as PostSharePlatform,
        shareType as PostShareType
      );

      res.status(200).json({
        success: true,
        shareId: result.shareId,
        shareUrl: result.shareUrl,
        platform: result.platform,
      });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private getPostShareAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;

      if (!postId)
        return res.status(400).json({ message: "Post ID is required" });

      if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid post ID format" });
      }

      const analytics = await getPostShareAnalytics(postId);

      res.status(200).json({
        success: true,
        postId,
        analytics,
      });
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };

  private handlePostShareClick = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { platform, encodedUrl } = req.params;

      if (!platform || !encodedUrl) {
        return res
          .status(400)
          .json({ message: "Platform and encoded URL are required" });
      }

      let originalUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");

      if (
        !originalUrl.startsWith("http://") &&
        !originalUrl.startsWith("https://")
      ) {
        originalUrl = `http://${originalUrl}`;
      }

      const shareUrl = `${req.protocol}://${req.get(
        "host"
      )}/posts/share/${platform}/${encodedUrl}`;

      await trackPostShareClick(shareUrl);

      res.redirect(originalUrl);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private retrieveNearbyRoomPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid } = req.params;
      const { lng, ltd } = req.query;

      if (!userid) return res.status(400).json({ message: "Id is required" });

      const nearbyPosts = await getNearRoomPost(
        userid,
        Number(lng),
        Number(ltd)
      );
      if (!nearbyPosts)
        return res.status(204).json({ message: "Post not found" });

      const nearbyPostsMedia = await listCheckImageUrl(nearbyPosts);

      return res.status(200).json(nearbyPostsMedia);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private retrieveNearbyPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid } = req.params;
      const { lng, ltd, page, perPage } = req.query;
      if (!lng || !ltd)
        return res.status(400).json({ message: "Location is needed" });

      if (!userid) return res.status(400).json({ message: "Id is required" });

      const nearbyPosts = await getNearbyPostsPaginated(
        userid,
        Number(lng),
        Number(ltd),
        Number(page),
        Number(perPage)
      );

      const nearbyPostsMedia = await listCheckImgUrlWithUser(nearbyPosts);

      return res.status(200).send(nearbyPostsMedia);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private retrieveUserPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid } = req.params;
      if (!userid) return res.status(400).json({ message: "Id is required" });

      //get users posts
      const foundPost = await getUserPost(userid);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      const foundPostMedia = await listCheckImageUrl(foundPost);

      return res.status(200).send(foundPostMedia);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private retrieveRoomPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { roomid, userid } = req.params;
      if (!roomid || !userid)
        return res.status(400).json({ message: "Id is required" });

      const foundPost = await getRoomPost(roomid);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      const foundPostMedia = await listCheckImageUrl(foundPost);

      return res.status(200).send(foundPostMedia);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
  private retrieveOneRoomPostMedia = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userid, roomid } = req.params;
      if (!userid || !roomid)
        return res.status(400).json({ message: "Id is required" });

      const page = Number(req.query.page);
      const perPage = Number(req.query.perPage);

      if (!perPage)
        return res.status(400).json({ message: "Per page is required" });
      if (!page) return res.status(400).json({ message: "Page is required" });

      const foundPost = await getRoomPostPaginated(roomid, page, perPage);
      if (!foundPost) return res.status(204).json({ message: "No Post Found" });

      const foundPostMedia = await listCheckRoomImgUrl(foundPost);

      return res.status(200).send(foundPostMedia);
    } catch (err: any) {
      return next(new HttpException(400, err.message));
    }
  };
}

export default PostController;
