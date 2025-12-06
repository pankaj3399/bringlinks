import Logging from "../../library/logging";
import { IPostDocument } from "./post.interface";
import Posts from "./post.model";
import mongoose from "mongoose";
import Likes from "../likes/likes.model";
import { IComments } from "../comments/comments.interface";
import Comments from "../comments/comments.model";
import User from "../user/user.model";
import Rooms from "../room/room.model";
import { getUserIMG } from "../user/user.service";

const getAPostById = async (_id: string, user_id: string) => {
  try {
    const foundedPost = await Posts.findPostById(_id);

    if (!foundedPost) throw new Error("Post not found");

    return foundedPost.populate([
      {
        path: "user_Id",
        model: "User",
        select:
          " -auth.username -auth.password -role -refreshToken -pendingRoomsRequest -enteredRooms",
      },
      { path: "comments", model: "Comments" },
      {
        path: "shares",
        model: "PostShare",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);
  } catch (err: any) {
    Logging.error(err);
  }
};
export const getUserPosts = async (userId: string, postId: string) => {
  try {
    const user_id = userId as string;

    let posts = await Posts.findOne({
      user_Id: user_id,
      _id: postId,
    }).populate({ path: "comments", model: "Comments" });
    if (!posts) throw new Error("Post not found");

    return posts;
  } catch (err: any) {
    Logging.error(err);
  }
};
export const getNearRoomPost = async (
  userId: string,
  lng: number,
  ltd: number
) => {
  try {
    var media = [];
    const foundedUser = await User.findOne({ _id: userId }).clone();
    if (!foundedUser?.profile.location.radiusPreference) {
      throw new Error("radius preference is needed");
    }
    const radiusPrefMeters =
      foundedUser?.profile.location.radiusPreference * 1609.34;

    if (!foundedUser.profile.location.currentLocation)
      throw new Error("current location is needed");

    const nearbyPosts = await Posts.find({
      // Commented out for now
      // Posts that are no more than 4 weeks old
      event_schedule: {
        endDate: {
          $gte: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000,
        },
      },
      // Posts that are not private
      // Posts that are near the user's current location
      postedLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, ltd],
          },
          $maxDistance: radiusPrefMeters,
        },
      },
      room_Id: { $exists: true, $ne: null },
    }).populate({ path: "comments", model: "Comments" });

    return nearbyPosts;
  } catch (err: any) {
    Logging.error(`Error in getNearPost: ${err}`);
    throw err;
  }
};

const getNearPost = async (userId: string, lng: number, ltd: number) => {
  try {
    const user_id = userId as string;
    if (!user_id) throw new Error("User not found");

    const user = await User.findOne({ _id: user_id });
    if (!user) throw new Error("User not found");

    let radiusPreference;
    if (user.profile?.location?.radiusPreference) {
      radiusPreference = user.profile.location.radiusPreference;
    } else if ((user as any).location?.radiusPreference) {
      radiusPreference = (user as any).location.radiusPreference;
    } else {
      throw new Error("radius preference is needed");
    }

    const convertRadius = radiusPreference * 1609.34;

    const coordinates = [lng, ltd];
    Logging.info(
      `Using coordinates from parameters: ${JSON.stringify(coordinates)}`
    );

    if (isNaN(lng) || isNaN(ltd)) {
      throw new Error(
        `Location coordinates must be valid numbers. Got lng: ${lng}, lat: ${ltd}`
      );
    }

    const nearPost = await Posts.find({
      postedLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, ltd],
          },
          $maxDistance: convertRadius,
        },
      },
    });

    return nearPost ?? [];
  } catch (err: any) {
    Logging.error(`Error in getNearPost: ${err}`);
    throw err;
  }
};

const createAPost = async (
  post: IPostDocument,
  user_id: string,
  roomId: string | undefined = ""
) => {
  try {
    const room_Id = roomId ? new mongoose.Types.ObjectId(roomId) : undefined;

    if (room_Id) {
      const room = await Rooms.findById(room_Id);
      if (!room) throw new Error("Room not found");
    }

    Logging.log(room_Id);
    const createdPost = await Posts.create({
      ...post,
      user_Id: user_id,
      room_Id,
    } as any);
    if (!createdPost) throw new Error("Post is not created");

    if (room_Id) {
      await Rooms.findByIdAndUpdate(
        { _id: room_Id },
        {
          $addToSet: { posts: createdPost._id },
        }
      );
    }
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
    throw err;
  }
};

export const createARoomPost = async (
  post: Partial<IPostDocument>,
  roomId: string,
  userId: string
) => {
  try {
    const createdPost = await Posts.create({
      ...post,
      user_Id: userId,
      room_Id: roomId,
    });

    if (!createdPost) throw new Error("Post is not created");

    const roomupdated = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $addToSet: { posts: createdPost._id },
      }
    );

    if (!roomupdated) throw new Error("Room not updated");

    return (
      await createdPost.populate({
        path: "user_Id",
        model: "User",
        select:
          "-auth.password -role -refreshToken -pendingRoomsRequest -enteredRooms",
      })
    ).populate({ path: "comments", model: "Comments" });
  } catch (err: any) {
    Logging.error(err);
    throw err;
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
export const getNearbyPostsPaginated = async (
  userId: string,
  lng: number,
  ltd: number,
  page: number,
  perPage: number
) => {
  try {
    const foundedUser = await User.findOne({ _id: userId }).clone();

    if (!foundedUser?.profile.location.radiusPreference) {
      throw new Error("radius preference is needed");
    }
    const radiusPrefMeters =
      foundedUser?.profile.location.radiusPreference * 1609.34;

    if (!foundedUser.profile.location.currentLocation)
      throw new Error("current location is needed");

    const nearbyPosts = await Posts.find({
      // Commented out for now
      // Posts that are no more than 4 weeks old
      // event_schedule: {
      //   endDate: {
      //     $gte: Date.now() - 4 * 7 * 24 * 60 * 60 * 1000,
      //   },
      // },
      // Posts that are not private
      // Posts that are near the user's current location
      postedLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, ltd],
          },
          $maxDistance: radiusPrefMeters,
        },
      },
    })
      .sort({ "stats.score": -1 })
      .skip(page * perPage - perPage)
      .limit(perPage)
      .populate([
        { path: "comments", model: "Comments" },
        { path: "likes", model: "Likes" },
        {
          path: "user_Id",
          model: "User",
          select: "_id auth.username profile.firstName profile.avi",
        },
      ]);

    return nearbyPosts;
  } catch (err: any) {
    Logging.error(`Error in getNearbyPosts: ${err}`);
    throw err;
  }
};
export const getCommentsReplyPaginated = async (
  postId: string,
  commentId: string,
  page: number,
  perPage: number
) => {
  try {
    const comments = await Comments.find({
      _id: commentId,
      post_Id: postId,
    })
      .sort({ "stats.score": -1 })
      .skip(page * perPage - perPage)
      .limit(perPage)
      .populate([
        {
          path: "user_id",
          model: "User",
          select:
            "-auth -role -refreshToken -pendingRoomsRequest -enteredRooms",
        },
        {
          path: "post_Id",
          model: "Posts",
          select: "-shares -comments -stats -postedLocation -user_Id -room_Id",
        },
        {
          path: "commentReply",
          model: "Comments",
        },
      ]);

    return comments;
  } catch (err: any) {
    Logging.error(`Error in getCommentsPaginated: ${err}`);
    throw err;
  }
};
export const getCommentsPaginated = async (
  postId: string,
  page: number,
  perPage: number
) => {
  try {
    const comments = await Posts.find({
      _id: postId,
    })
      .sort({ "stats.score": -1 })
      .skip(page * perPage - perPage)
      .limit(perPage)
      .lean()
      .populate([
        {
          path: "user_Id",
          model: "User",
          select:
            "-auth.password -auth.email -role -refreshToken -pendingRoomsRequest -enteredRooms -profile.lastName -profile.firstName -profile.birthDate -profile.occupation -profile.privacy -profile.location -enteredRooms -refreshToken -pendingRoomsRequest",
        },
        { path: "comments", model: "Comments" },
      ]);

    return comments;
  } catch (err: any) {
    Logging.error(`Error in getCommentsPaginated: ${err}`);
    throw err;
  }
};

export const getCommentsWithImages = async (posts: IPostDocument[]) => {
  try {
    const commentsWithImages = await Promise.all(
      posts.map(async (post, index) => {
        const foundComment = await Comments.findById(
          post.comments[index]._id
        ).populate([
          {
            path: "user_id",
            model: "User",
            select: "_id auth.username profile.firstName profile.avi",
          },
        ]);

        const populatedUser = foundComment?.user_id as unknown as
          | {
              _id: mongoose.Types.ObjectId;
              auth: { username: string };
              profile: { firstName: string; avi: string };
            }
          | undefined;

        const Images = await getUserIMG(
          populatedUser?._id.toString() as string
        );
        Logging.log(`Images: ${JSON.stringify(Images)}`);
        return {
          ...post,
          comments: post.comments.map((comment) => {
            return {
              ...comment,
              user_id: populatedUser,
              userIMG: Images,
            };
          }),
        };
      })
    );

    return commentsWithImages;
  } catch (err: any) {
    Logging.error(`Error in getCommentsWithImages: ${err}`);
    throw err;
  }
};

export const getRoomPostPaginated = async (
  roomId: string,
  page: number,
  perPage: number
) => {
  try {
    const posts = await Posts.find({
      room_Id: roomId,
    })
      .sort({ "stats.score": -1 })
      .skip(page * perPage - perPage)
      .limit(perPage)
      .populate([
        {
          path: "room_Id",
          model: "Rooms",
          select:
            "event_name event_type event_typeOther event_location_address event_location event_schedule event_privacy paid created_user specialGuest event_sponsors shares stats",
        },
        {
          path: "shares",
          model: "PostShare",
          select: "platform shareType shareUrl analytics createdAt",
        },
        {
          path: "user_Id",
          model: "User",
          select:
            "_id auth.username profile.location.currentLocation.coordinates",
        },
      ]);

    return posts;
  } catch (err: any) {
    Logging.error(`Error in getRoomPostPaginated: ${err}`);
    throw err;
  }
};
export const getRoomPost = async (roomId: string) => {
  try {
    const nearbyPosts = await Posts.find({
      room_Id: roomId,
    }).populate([
      {
        path: "room_Id",
        model: "Rooms",
        select:
          "event_name event_type event_typeOther event_location_address event_location event_schedule event_privacy paid created_user event_flyer_img event_media_img event_venue_image specialGuest event_sponsors shares stats",
      },
      {
        path: "shares",
        model: "PostShare",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);

    return nearbyPosts;
  } catch (err: any) {
    Logging.error(`Error in getNearPost: ${err}`);
    throw err;
  }
};
export const getUserPost = async (userId: string) => {
  try {
    const foundedPost = await Posts.find({ user_Id: userId }).populate([
      {
        path: "user_Id",
        model: "User",
        select:
          "-auth -role -refreshToken -pendingRoomsRequest -enteredRooms -profile.lastName -profile.firstName -profile.birthDate -profile.occupation -profile.privacy -profile.location -enteredRooms -refreshToken -pendingRoomsRequest",
      },
      {
        path: "shares",
        model: "PostShare",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);
    if (!foundedPost) throw new Error("Post not found");
    return foundedPost;
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const updatePostMedia = async (
  postid: string,
  media: string,
  fileName: string
) => {
  try {
    const foundPost = await Posts.findByIdAndUpdate(
      { _id: postid },
      {
        $set: { "content.url": media, "content.name": fileName },
      },
      { new: true }
    );
    if (!foundPost) throw new Error(`Post isn't updated`);
    return foundPost.populate([
      {
        path: "user_Id",
        model: "User",
        select:
          "_id auth.username profile.location.currentLocation.coordinates",
      },
      {
        path: "shares",
        model: "PostShare",
        select: "platform shareType shareUrl analytics createdAt",
      },
    ]);
  } catch (err: any) {
    Logging.error(err);
    throw err;
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
    throw err;
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

    const populatedPost = await (
      await updatedPost.populate({
        path: "user_Id",
        model: "User",
        select:
          "_id auth.username profile.location.currentLocation.coordinates",
      })
    ).populate({ path: "likes", model: "Likes" });

    return {
      post: populatedPost,
      likeId: like._id,
    };
  } catch (err: any) {
    Logging.log(err);
    throw err;
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
    throw err;
  }
};
export const commentReply = async (
  userid: string,
  comment_id: string,
  comment: Partial<IComments>,
  postId: string
) => {
  try {
    const user_id = new mongoose.Types.ObjectId(userid);
    const commentId = new mongoose.Types.ObjectId(comment_id);
    const post_Id = new mongoose.Types.ObjectId(postId);

    // CREATE COMMENT
    const createdComment = await Comments.create({
      content: comment.content,
      post_Id,
      user_id,
    });

    // UPDATE COMMENT
    const postComments = await Comments.findByIdAndUpdate(
      { _id: commentId },
      {
        $addToSet: { commentReply: createdComment._id },
      },
      { new: true }
    );

    return postComments?.populate([
      { path: "commentReply", model: "Comments" },
      { path: "post_Id", model: "Posts" },
      {
        path: "user_id",
        model: "User",
        select:
          "-auth.password -role -refreshToken -pendingRoomsRequest -enteredRooms",
      },
    ]);
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};
const comment = async (
  userid: string,
  post_id: string,
  comment: Partial<IComments>,
  roomId: string | undefined = ""
) => {
  try {
    const postId = new mongoose.Types.ObjectId(post_id);
    const userId = new mongoose.Types.ObjectId(userid);
    const room_Id = roomId ? new mongoose.Types.ObjectId(roomId) : undefined;

    const foundPost = await Posts.findById(postId);
    if (!foundPost) throw new Error("Post not found");

    if (room_Id) {
      const room = await Rooms.findById(room_Id);
      // find post with roomId
      const foundPostWithRoomId = await Posts.findOne({
        _id: postId,
        room_Id: room_Id,
      });
      Logging.log(foundPostWithRoomId);
      if (!room || !foundPostWithRoomId) throw new Error("Room Post Not Found");
    }

    const createdComment = await Comments.create({
      content: comment.content,
      post_Id: postId,
      user_id: userId,
      roomId: room_Id,
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
    throw err;
  }
};
export const updateViews = async (postId: string) => {
  try {
    const post = await Posts.findByIdAndUpdate(
      { _id: postId },
      {
        $inc: { "stats.views": 1 },
      },
      { new: true }
    );

    return post?.populate({
      path: "comments",
      model: "Comments",
      select: "-stats",
    });
  } catch (err: any) {
    Logging.error(err);
  }
};
export const getLikes = async (postId: string, userId: string) => {
  try {
    const likes = await Likes.find({
      posts: postId,
      user_Id: userId,
    });

    return likes;
  } catch (err: any) {
    Logging.error(`Error in getLikesPaginated: ${err}`);
    throw err;
  }
};
export const updatePostStats = async (postId: string, timeViewed: number) => {
  try {
    // update post stats with timeViewed in seconds
    const post = await Posts.findByIdAndUpdate(
      { _id: postId },
      {
        $inc: { "stats.totalSecondsViewed": timeViewed },
      },
      { new: true, upsert: true }
    );

    if (!post) throw new Error("Post not found");

    return post.populate({
      path: "comments",
      model: "Comments",
      select: "-stats",
    });
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
