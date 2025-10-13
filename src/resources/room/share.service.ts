import mongoose from "mongoose";
import Share, { IShare, SharePlatform, ShareType } from "./share.model";
import Rooms from "./room.model";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";

export const generateShareLinks = async (
  roomId: string,
  shareType: ShareType = ShareType.ROOM_ACCESS,
  userId?: string,
  tierName?: string
) => {
  try {
    const baseUrl = validateEnv.FRONTEND_URL.replace(/\/$/, ''); 
    const roomUrl = `${baseUrl}/room/${roomId}`;
    
    let originalUrl = roomUrl;
    if (shareType === ShareType.PURCHASE && tierName) {
      originalUrl = `${baseUrl}/purchase/${roomId}?tier=${encodeURIComponent(tierName)}`;
    } else if (shareType === ShareType.ENTRY && userId) {
      originalUrl = `${baseUrl}/entry/${roomId}?user=${userId}`;
    }

    const shareLinks = {
      facebook: generateFacebookShareUrl(originalUrl),
      tiktok: generateTikTokShareUrl(originalUrl),
      sms: generateSMSShareUrl(originalUrl),
      inAppMessage: originalUrl
    };

    return shareLinks;
  } catch (error: any) {
    Logging.error(`Error generating share links: ${error.message}`);
    throw error;
  }
};

export const trackShare = async (
  roomId: string,
  platform: SharePlatform,
  shareType: ShareType = ShareType.ROOM_ACCESS,
  userId?: string
) => {
  try {
    const baseUrl = validateEnv.FRONTEND_URL.replace(/\/$/, ''); 
    const roomUrl = `${baseUrl}/room/${roomId}`;
    
    let originalUrl = roomUrl;
    if (shareType === ShareType.PURCHASE) {
      originalUrl = `${baseUrl}/purchase/${roomId}`;
    } else if (shareType === ShareType.ENTRY && userId) {
      originalUrl = `${baseUrl}/entry/${roomId}?user=${userId}`;
    }

    const shareUrl = generateShareUrl(originalUrl, platform);

    let share = await Share.findOne({ shareUrl });
    
    if (!share) {
      share =       await Share.create({
        roomId: new mongoose.Types.ObjectId(roomId),
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        platform,
        shareType,
        shareUrl
      });

      await Rooms.findByIdAndUpdate(roomId, {
        $push: { shares: share._id }
      });
    }

    await Share.findByIdAndUpdate(share._id, {
      $inc: { "analytics.shares": 1 }
    });

    return {
      shareId: share._id,
      shareUrl: share.shareUrl,
      platform: share.platform
    };
  } catch (error: any) {
    Logging.error(`Error tracking share: ${error.message}`);
    throw error;
  }
};

export const trackClick = async (shareUrl: string) => {
  try {
    const share = await Share.findOneAndUpdate(
      { shareUrl },
      {
        $inc: { "analytics.clicks": 1 }
      },
      { new: true }
    ).populate("roomId", "event_name event_type");

    if (!share) {
      throw new Error("Share not found");
    }

    return share;
  } catch (error: any) {
    Logging.error(`Error tracking click: ${error.message}`);
    throw error;
  }
};

export const trackConversion = async (shareUrl: string) => {
  try {
    const share = await Share.findOneAndUpdate(
      { shareUrl },
      { $inc: { "analytics.conversions": 1 } },
      { new: true }
    );

    return share;
  } catch (error: any) {
    Logging.error(`Error tracking conversion: ${error.message}`);
    throw error;
  }
};

export const getRoomShareAnalytics = async (roomId: string) => {
  try {
    const Rooms = (await import("./room.model")).default;
    const room = await Rooms.findById(roomId).populate({
      path: "shares",
      select: "platform shareType shareUrl analytics createdAt"
    });

    if (!room) {
      throw new Error("Room not found");
    }

    const analytics = await Share.aggregate([
      { $match: { roomId: new mongoose.Types.ObjectId(roomId) } },
      {
        $group: {
          _id: "$platform",
          totalShares: { $sum: "$analytics.shares" },
          totalClicks: { $sum: "$analytics.clicks" },
          totalConversions: { $sum: "$analytics.conversions" },
          clickThroughRate: {
            $avg: {
              $cond: [
                { $gt: ["$analytics.shares", 0] },
                { $divide: ["$analytics.clicks", "$analytics.shares"] },
                0
              ]
            }
          }
        }
      },
      { $sort: { totalShares: -1 } }
    ]);

    const totalStats = await Share.aggregate([
      { $match: { roomId: new mongoose.Types.ObjectId(roomId) } },
      {
        $group: {
          _id: null,
          totalShares: { $sum: "$analytics.shares" },
          totalClicks: { $sum: "$analytics.clicks" },
          totalConversions: { $sum: "$analytics.conversions" }
        }
      }
    ]);

    return {
      platformBreakdown: analytics,
      totalStats: totalStats[0] || { totalShares: 0, totalClicks: 0, totalConversions: 0 },
      shares: room.shares || []
    };
  } catch (error: any) {
    Logging.error(`Error getting room analytics: ${error.message}`);
    throw error;
  }
};

const generateShareUrl = (url: string, platform: SharePlatform): string => {
  const encodedUrl = Buffer.from(url, 'utf-8').toString('base64');
  const baseUrl = 'http://localhost:3000';
  
  return `${baseUrl}/rooms/share/${platform}/${encodedUrl}`;
};

const generateFacebookShareUrl = (url: string): string => {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
};

const generateTikTokShareUrl = (url: string): string => {
  return url;
};


const generateSMSShareUrl = (url: string): string => {
  return `sms:?body=${encodeURIComponent(`Check out this event: ${url}`)}`;
};

