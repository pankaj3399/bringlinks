import Logging from "../../library/logging";
import { IPostDocument } from "./post.interface";
import Posts from "./post.model";
import mongoose from "mongoose";
import Likes from "../likes/likes.model";
import { IComments } from "../comments/comments.interface";
import Comments from "../comments/comments.model";
import User from "../user/user.model";
import { CurrentLo } from "resources/user/user.interface";

const getAPostById = async (_id: string, user_id: string) => {
  try {
    const foundedPost = await Posts.findPostById(_id);

    if (!foundedPost) throw new Error("Post not found");

    return foundedPost.populate({
      path: "user_Id",
      model: "User",
      select:
        " -auth.username -auth.password -role -refreshToken -pendingRoomsRequest -enteredRooms",
    });
  } catch (err: any) {
    Logging.error(err);
  }
};

const getNearPost = async (
  userId: string,
  location: Pick<CurrentLo, "type" | "coordinates">
) => {
  try {
    const user_id = userId as string;
    if (!user_id) throw new Error("User not found");

    const user = await User.findByIdAndUpdate(
      { _id: user_id },
      {
        $set: {
          "location.currentLocation": location,
        },
      }
    );
    if (!user) throw new Error("User not found");
    const convertRadius = user.profile.location.radiusPreference * 1609.34;

    const [lng, lat] = user.profile.location.currentLocation.coordinates;

    const nearPost = await Posts.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance",
          spherical: true,
          maxDistance: convertRadius,
          key: "postedLocation",
        },
      },
    ]);

    return nearPost ?? [];
  } catch (err: any) {
    Logging.error(err);
  }
};

const createAPost = async (post: IPostDocument, user_id: string) => {
  try {
    const createdPost = await Posts.create({
      ...post,
      user_Id: user_id,
    } as any);
    if (!createdPost) throw new Error("Post is not created");

    const user = user_id as string;

    const updatedPost = await Posts.findByIdAndUpdate(createdPost._id, {
      $set: {
        user_Id: user,
      },
    })
      .clone()
      .exec();

    await User.updateOne(
      { _id: user },
      {
        $set: { posts: createdPost._id },
      }
    );
    if (!updatedPost) throw new Error(`Post isn't updated in User`);

    Logging.info(updatedPost);
    return (
      await updatedPost.populate({ path: "comments", model: "Comments" })
    ).populate({ path: "likes", model: "Likes" });
  } catch (err: any) {
    Logging.error(err);
  }
};

const deleteAPost = async (user_id: string, post_id: string) => {
  try {
    const userId = user_id as string;
    const postid = post_id as string;

    const foundPost = await Posts.findOne({ _id: postid });
    if (!foundPost) throw new Error("post not found");

    if (foundPost.user_Id?.toString() !== userId)
      throw new Error("Post does not belong to user");

    const deletedPost = await Posts.deletePostById(post_id);
    if (!deletedPost) throw Error("User not deleted");

    const deletedUserPost = await User.updateOne(
      { _id: userId },
      {
        $pull: { posts: postid },
      }
    );
    if (!deletedUserPost) throw new Error(`Post isn't deleted from User`);

    return deletedPost;
  } catch (err: any) {
    Logging.error(err);
  }
};

const updatePost = async (post: Partial<IPostDocument>) => {
  try {
    const userId = post.user_Id?.toString();
    if (!userId || post.user_Id?.toString() !== userId)
      throw new Error("Post does not belong to user");

    const foundPost = await Posts.findByIdAndUpdate(
      { _id: post._id },
      {
        $set: {
          content: post.content,
        },
      }
    );
    if (!foundPost) throw new Error("Post is not updated");

    return (
      await (
        await foundPost.populate({
          path: "user_Id",
          model: "User",
          select:
            "_id auth.username profile.location.currentLocation.coordinates",
        })
      ).populate({ path: "likes", model: "Likes" })
    ).populate({ path: "comments", model: "Comments" });
  } catch (err: any) {
    Logging.log(err);
  }
};

const likeAPost = async (post_id: string, user_id: string) => {
  try {
    const likedUserId = new mongoose.Types.ObjectId(user_id);
    const postId = new mongoose.Types.ObjectId(post_id);

    const like = await Likes.create({
      posts: postId,
      user_Id: likedUserId,
    });

    const updatedPost = await Posts.findOneAndUpdate(
      { _id: postId },
      {
        $addToSet: { likes: like._id },
        $inc: { likes_count: +1 },
      }
    );

    if (!updatedPost) throw new Error("failed to add like");

    return (
      await updatedPost.populate({
        path: "user_Id",
        model: "User",
        select:
          "_id auth.username profile.location.currentLocation.coordinates",
      })
    ).populate({ path: "likes", model: "Likes" });
  } catch (err: any) {
    Logging.log(err);
  }
};
const unLikeAPost = async (
  user_id: string,
  post_id: string,
  like_id: string
) => {
  try {
    const likeId = new mongoose.Types.ObjectId(like_id);
    const postId = new mongoose.Types.ObjectId(post_id);
    const userId = new mongoose.Types.ObjectId(user_id);

    //find if user_id is the save liked id or postlikedID
    const foundLikes = await Likes.findById({ _id: likeId });
    if (!foundLikes) throw new Error("like not found");

    const updatedPost = await Posts.findByIdAndUpdate(
      { _id: postId },
      {
        $pull: {
          likes: likeId,
        },
        $inc: { likes_count: -1 },
      }
    );

    const like = await Likes.findOneAndDelete({
      _id: likeId,
      user_Id: userId,
      posts: postId,
    });

    return updatedPost;
  } catch (err: any) {
    Logging.log(err);
  }
};

const comment = async (
  userid: string,
  post_id: string,
  comment: Partial<IComments>
) => {
  try {
    const postId = new mongoose.Types.ObjectId(post_id);
    const userId = new mongoose.Types.ObjectId(userid);

    const createdComment = await Comments.create({
      content: comment.content,
      post_Id: postId,
      user_id: userId,
    });

    if (!createdComment) throw new Error("Comment not created");

    const postComments = await Posts.findByIdAndUpdate(
      { _id: postId },
      {
        $addToSet: { comments: createdComment._id },
      },
      { new: true }
    );

    return postComments?.populate({ path: "comments", model: "Comments" });
  } catch (err: any) {
    Logging.error(err);
  }
};

const deleteComment = async (post_id: string, comment_id: string) => {
  try {
    const postId = new mongoose.Types.ObjectId(post_id);
    const commentId = new mongoose.Types.ObjectId(comment_id);

    await Comments.deleteOne({ _id: commentId }).clone();

    const updatedPost = await Posts.updateOne(
      { _id: postId },
      {
        $pull: {
          comments: commentId,
        },
      },
      { new: true }
    ).clone();

    return updatedPost;
  } catch (err: any) {
    Logging.log(err);
  }
};

const editComment = async (
  comment: IComments,
  post_id: string,
  userid: string
) => {
  try {
    const postId = new mongoose.Types.ObjectId(post_id);
    const userId = new mongoose.Types.ObjectId(userid);

    const updatedComment = await Comments.findByIdAndUpdate(
      { _id: comment._id, post_Id: postId, user_id: userId },
      {
        $set: {
          content: comment.content,
        },
      }
    ).clone();
    if (!updatedComment) throw new Error("Comment not updated");

    return updatedComment.populate({ path: "post_Id", model: "Posts" });
  } catch (err: any) {
    Logging.error(err);
  }
};

export {
  getAPostById,
  createAPost,
  updatePost,
  deleteAPost,
  comment,
  deleteComment,
  editComment,
  likeAPost,
  unLikeAPost,
  getNearPost,
};
