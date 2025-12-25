import mongoose from "mongoose";
import PostShare, {
  IPostShare,
  PostSharePlatform,
  PostShareType,
} from "./postShare.model";
import Posts from "../post.model";
import { validateEnv } from "../../../../config/validateEnv";
import Logging from "../../../library/logging";

export const generatePostShareLinks = async (
  postId: string,
  shareType: PostShareType = PostShareType.POST_SHARE,
  userId?: string
) => {
  try {
    const baseUrl = validateEnv.FRONTEND_URL.replace(/\/$/, "");
    const postUrl = `${baseUrl}/post/${postId}`;

    let originalUrl = postUrl;
    if (shareType === PostShareType.POST_PROMOTION) {
      originalUrl = `${baseUrl}/post/${postId}?promo=true`;
    }

    const shareLinks = {
      facebook: generateFacebookShareUrl(originalUrl),
      tiktok: generateTikTokShareUrl(originalUrl),
      sms: generateSMSShareUrl(originalUrl),
      inAppMessage: originalUrl,
    };

    return shareLinks;
  } catch (error: any) {
    Logging.error(`Error generating post share links: ${error.message}`);
    throw error;
  }
};

export const trackPostShare = async (
  postId: string,
  userId: string,
  platform: PostSharePlatform,
  shareType: PostShareType = PostShareType.POST_SHARE
) => {
  try {
    const baseUrl = validateEnv.FRONTEND_URL.replace(/\/$/, "");
    const postUrl = `${baseUrl}/post/${postId}`;

    let originalUrl = postUrl;
    if (shareType === PostShareType.POST_PROMOTION) {
      originalUrl = `${baseUrl}/post/${postId}?promo=true`;
    }

    const shareUrl = generateShareUrl(originalUrl, platform);

    let share = await PostShare.findOne({ shareUrl });

    if (!share) {
      share = await PostShare.create({
        postId: new mongoose.Types.ObjectId(postId),
        userId: new mongoose.Types.ObjectId(userId),
        platform,
        shareType,
        shareUrl,
      });

      await Posts.findByIdAndUpdate(postId, {
        $push: { shares: share._id },
      });
    }

    await PostShare.findByIdAndUpdate(share._id, {
      $inc: { "analytics.shares": 1 },
    });

    return {
      shareId: share._id,
      shareUrl: share.shareUrl,
      platform: share.platform,
    };
  } catch (error: any) {
    Logging.error(`Error tracking post share: ${error.message}`);
    throw error;
  }
};

export const trackPostShareClick = async (shareUrl: string) => {
  try {
    const share = await PostShare.findOne({ shareUrl });
    if (!share) {
      throw new Error("Share not found");
    }

    await PostShare.findByIdAndUpdate(share._id, {
      $inc: { "analytics.clicks": 1 },
    });

    return share;
  } catch (error: any) {
    Logging.error(`Error tracking post share click: ${error.message}`);
    throw error;
  }
};

export const getPostShareAnalytics = async (postId: string) => {
  try {
    const Posts = (await import("../post.model")).default;
    const post = await Posts.findById(postId).populate({
      path: "shares",
      select: "platform shareType shareUrl analytics createdAt",
    });

    if (!post) {
      throw new Error("Post not found");
    }

    const analytics = await PostShare.aggregate([
      { $match: { postId: new mongoose.Types.ObjectId(postId) } },
      {
        $group: {
          _id: null,
          totalShares: { $sum: "$analytics.shares" },
          totalClicks: { $sum: "$analytics.clicks" },
          totalConversions: { $sum: "$analytics.conversions" },
          platformBreakdown: {
            $push: {
              platform: "$platform",
              shares: "$analytics.shares",
              clicks: "$analytics.clicks",
              conversions: "$analytics.conversions",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalStats: {
            totalShares: "$totalShares",
            totalClicks: "$totalClicks",
            totalConversions: "$totalConversions",
          },
          platformBreakdown: {
            $map: {
              input: "$platformBreakdown",
              as: "platform",
              in: {
                _id: "$$platform.platform",
                totalShares: "$$platform.shares",
                totalClicks: "$$platform.clicks",
                totalConversions: "$$platform.conversions",
              },
            },
          },
        },
      },
    ]);

    return {
      ...(analytics[0] || {
        totalStats: { totalShares: 0, totalClicks: 0, totalConversions: 0 },
        platformBreakdown: [],
      }),
      shares: post.shares || [],
    };
  } catch (error: any) {
    Logging.error(`Error getting post share analytics: ${error.message}`);
    throw error;
  }
};

function generateFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    url
  )}`;
}

function generateTikTokShareUrl(url: string): string {
  return url;
}

function generateSMSShareUrl(url: string): string {
  return `sms:?body=${encodeURIComponent(`Check out this post: ${url}`)}`;
}

function generateShareUrl(
  originalUrl: string,
  platform: PostSharePlatform
): string {
  const encodedUrl = Buffer.from(originalUrl, "utf-8").toString("base64");
  const baseUrl = "http://localhost:3000";
  return `${baseUrl}/posts/share/${platform}/${encodedUrl}`;
}
