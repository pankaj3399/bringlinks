import { Router, Request, Response, NextFunction } from "express";
import Logging from "../../library/logging";
import HttpException from "../../middleware/exceptions/http.exception";
import Controller from "utils/interfaces/controller.interface";
import {
  comment,
  createAPost,
  deleteAPost,
  deleteComment,
  editComment,
  getAPostById,
  getNearPost,
  likeAPost,
  unLikeAPost,
  updatePost,
} from "./post.service";
import {
  generatePostShareLinks,
  trackPostShare,
  trackPostShareClick,
  getPostShareAnalytics
} from "./postShare.service";
import { PostSharePlatform, PostShareType } from "./postShare.model";
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
import { getUserById } from "resources/user/user.service";

class PostController implements Controller {
  public path = "/posts";
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/:postId/share-links`,
      this.getPostShareLinks
    );
    this.router.post(
      `${this.path}/:postId/share`,
      this.trackPostShare
    );
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
    this.router.get(`${this.path}/:userid/:postid`, RequiredAuth, this.getPost);
    this.router.get(
      `${this.path}/nearpost/:userId`,
      RequiredAuth,
      validationMiddleware(validate.getNearPost),
      this.getNearPost
    );
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
    this.router.post(
      `${this.path}/comment/:userid/:postid`,
      //RequiredAuth,
      validationMiddleware(commentValidate.createComment),
      this.comment
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
  }
  private getNearPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ message: "Id is required" });

      const foundPost = await getNearPost(userId, req.body);
      if (!foundPost)
        return res.status(400).json({ message: "Post not found" });

      res.status(200).json(foundPost);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
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
      new HttpException(500, err);
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
      // ensure user_Id is set on body for schema validation
      (req.body as any).user_Id = userid;
      const foundPost = await createAPost(req.body, userid);

      if (!foundPost)
        return res.status(400).json({ message: "Post not created" });

      res.status(201).json(foundPost);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err);
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
      new HttpException(500, err);
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

      const comments = await comment(userid, postid, req.body);
      if (!comments)
        return res.status(400).json({ message: "Comment not created" });

      res.status(200).json(comments);
    } catch (err: any) {
      Logging.error(err);
      new HttpException(500, err.message);
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
      new HttpException(500, err);
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

      if (!postId) return res.status(400).json({ message: "Post ID is required" });

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
        shareLinks
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private trackPostShare = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;
      const { platform, shareType = PostShareType.POST_SHARE, userId } = req.body;

      if (!postId) return res.status(400).json({ message: "Post ID is required" });
      if (!platform) return res.status(400).json({ message: "Platform is required" });
      if (!userId) return res.status(400).json({ message: "User ID is required" });

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
        shareUrl: result.shareUrl,
        originalUrl: result.originalUrl,
        platform: result.platform
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };

  private getPostShareAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { postId } = req.params;

      if (!postId) return res.status(400).json({ message: "Post ID is required" });

      if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid post ID format" });
      }

      const analytics = await getPostShareAnalytics(postId);

      res.status(200).json({
        success: true,
        postId,
        analytics
      });
    } catch (err: any) {
      next(new HttpException(400, err.message));
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
        return res.status(400).json({ message: "Platform and encoded URL are required" });
      }

      let originalUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
      
      if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
        originalUrl = `http://${originalUrl}`;
      }
      
      const shareUrl = `${req.protocol}://${req.get('host')}/posts/share/${platform}/${encodedUrl}`;

      await trackPostShareClick(shareUrl);

      res.redirect(originalUrl);
    } catch (err: any) {
      next(new HttpException(400, err.message));
    }
  };
}

export default PostController;
