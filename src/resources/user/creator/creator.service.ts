import Creator from "./creator.model";
import User from "../user.model";
import SignupCode from "../../signupCode/signupCode.model";
import { ICreatorRegistrationRequest, ICreatorSignupRequest, StripeAccountStatus } from "./creator.interface";
import { validateEnv } from "../../../../config/validateEnv";
import Logging from "../../../library/logging";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "../../../utils/authentication/jwt.createtoken";
import StripeService from "../../../utils/stripe/stripe.service";

export const signupAsCreator = async (creatorData: ICreatorSignupRequest) => {
  try {
    const { email, password, firstName, lastName, state, signupCode, ...applicationData } = creatorData;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const parseAllowedStates = (): string[] => {
      const raw = validateEnv.ALLOWED_STATES || "";
      return raw
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter((s: string) => !!s);
    };

    const allowedStates = parseAllowedStates();
    if (!allowedStates.includes(state.trim().toLowerCase())) {
      throw new Error("Creator registration not available in your state");
    }

    const signupCodeDoc = await SignupCode.findOne({ 
      code: signupCode,
      isActive: true,
      isUsed: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (!signupCodeDoc) {
      throw new Error("Invalid or expired signup code");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      auth: {
        username: email,  
        email: email,
        password: hashedPassword,
      },
      profile: {
        firstName: firstName,
        lastName: lastName,
        birthDate: new Date(), 
        occupation: "Creator", 
      },
      state: state,
      role: "USER", 
      isVerified: false, 
    });

    if (!user) {
      throw new Error("User creation failed");
    }

    const creator = await Creator.create({
      userId: user._id,
      signupCode,
      ...applicationData,
    });

    if (!creator) {
      await User.findByIdAndDelete(user._id);
      throw new Error("Creator registration failed");
    }

    await User.findByIdAndUpdate(user._id, {
      role: "CREATOR",
      creator: creator._id
    });

    await SignupCode.findByIdAndUpdate(signupCodeDoc._id, { 
      isUsed: true,
      usedBy: user._id.toString(),
      usedAt: new Date()
    });

    const [accessToken, refreshToken] = jwt.CreateToken({ userId: user._id.toString() });

    Logging.log(`Creator signed up successfully: ${creator._id}`);
    
    return {
      user: {
        _id: user._id,
        email: user.auth.email,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        state: user.state,
        role: user.role,
      },
      creator: {
        _id: creator._id,
        signupCode: creator.signupCode,
        portfolio: creator.portfolio,
        socialMedia: creator.socialMedia,
        experience: creator.experience,
        stripeAccountStatus: creator.stripeAccountStatus,
      },
      token: accessToken,
      refreshToken
    };
  } catch (err: any) {
    Logging.error(`Creator signup error: ${err.message}`);
    throw err;
  }
};

export const registerCreator = async (creatorData: ICreatorRegistrationRequest) => {
  try {
    const { userId, signupCode, ...applicationData } = creatorData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const parseAllowedStates = (): string[] => {
      const raw = validateEnv.ALLOWED_STATES || "";
      return raw
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter((s: string) => !!s);
    };

    const allowedStates = parseAllowedStates();
    if (user.state && !allowedStates.includes(user.state.trim().toLowerCase())) {
      throw new Error("Creator registration not available in your state");
    }

    const signupCodeDoc = await SignupCode.findOne({ 
      code: signupCode,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!signupCodeDoc) {
      throw new Error("Invalid or expired signup code");
    }

    const existingCreator = await Creator.findOne({ userId });
    if (existingCreator) {
      throw new Error("User is already registered as creator");
    }

    const creator = await Creator.create({
      userId,
      signupCode,
      ...applicationData,
    });

    if (!creator) {
      throw new Error("Creator registration failed");
    }

    await SignupCode.findByIdAndUpdate(signupCodeDoc._id, { 
      isUsed: true,
      usedBy: userId,
      usedAt: new Date()
    });

    await User.findByIdAndUpdate(userId, { 
      role: "CREATOR",
      creator: creator._id
    });

    Logging.log(`Creator registered successfully: ${creator._id}`);
    return creator;
  } catch (err: any) {
    Logging.error(`Creator registration error: ${err.message}`);
    throw err;
  }
};

export const canCreatePaidRooms = async (userId: string) => {
  try {
    if ((validateEnv.FORCE_CREATOR_ELIGIBLE || "").toString().toLowerCase() === "true") {
      return { canCreate: true };
    }

    const creator = await Creator.findOne({ userId });
    
    if (!creator) {
      return {
        canCreate: false,
        reason: "Creator account not found",
        action: "register_as_creator"
      };
    }

    if (!creator.stripeConnectAccountId) {
      return {
        canCreate: false,
        reason: "Stripe Connect account required",
        redirectTo: "/creator/stripe-connect/onboard",
        action: "redirect_to_stripe_connect"
      };
    }

    if (creator.stripeAccountStatus !== StripeAccountStatus.ACTIVE) {
      return {
        canCreate: false,
        reason: "Stripe Connect account not active",
        redirectTo: "/creator/stripe-connect/onboard",
        action: "redirect_to_stripe_connect"
      };
    }

    return {
      canCreate: true
    };
  } catch (err: any) {
    Logging.error(`Can create paid rooms check error: ${err.message}`);
    throw err;
  }
};

export const getCreatorByUserId = async (userId: string) => {
  try {
    return await Creator.findOne({ userId }).populate("userId");
  } catch (err: any) {
    Logging.error(`Get creator by user ID error: ${err.message}`);
    throw err;
  }
};

export const getCreatorById = async (creatorId: string) => {
  try {
    return await Creator.findCreatorById(creatorId);
  } catch (err: any) {
    Logging.error(`Get creator by ID error: ${err.message}`);
    throw err;
  }
};

export const updateCreatorProfile = async (creatorId: string, updateData: Partial<ICreatorRegistrationRequest>) => {
  try {
    return await Creator.findByIdAndUpdate(creatorId, updateData, { new: true });
  } catch (err: any) {
    Logging.error(`Update creator profile error: ${err.message}`);
    throw err;
  }
};

export const initiateStripeConnectOnboarding = async (userId: string, returnUrl: string, refreshUrl: string) => {
  try {
    const creator = await Creator.findOne({ userId });
    if (!creator) {
      throw new Error("Creator not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let stripeAccountId = creator.stripeConnectAccountId;

    if (!stripeAccountId) {
      const stripeAccount = await StripeService.createConnectAccount(
        userId,
        user.auth.email,
        user.state || "US"
      );
      stripeAccountId = stripeAccount.id;

      await Creator.findByIdAndUpdate(creator._id, {
        stripeConnectAccountId: stripeAccountId,
        stripeAccountStatus: StripeAccountStatus.PENDING,
      });
    }

    const accountLink = await StripeService.createAccountLink(
      stripeAccountId,
      returnUrl,
      refreshUrl
    );

    await Creator.findByIdAndUpdate(creator._id, {
      stripeAccountLink: accountLink.url,
    });

    return {
      accountId: stripeAccountId,
      accountLink: accountLink.url,
      status: StripeAccountStatus.PENDING,
    };
  } catch (err: any) {
    Logging.error(`Stripe Connect onboarding error: ${err.message}`);
    throw err;
  }
};

export const getStripeConnectStatus = async (userId: string) => {
  try {
    const creator = await Creator.findOne({ userId });
    if (!creator) {
      throw new Error("Creator not found");
    }

    if (!creator.stripeConnectAccountId) {
      return {
        accountId: null,
        status: StripeAccountStatus.PENDING,
        accountLink: null,
        isReady: false,
      };
    }

    const isReady = await StripeService.isAccountReady(creator.stripeConnectAccountId);
    const realStatus = isReady ? StripeAccountStatus.ACTIVE : StripeAccountStatus.PENDING;

    if (creator.stripeAccountStatus !== realStatus) {
      await Creator.findByIdAndUpdate(creator._id, {
        stripeAccountStatus: realStatus,
      });
    }

    return {
      accountId: creator.stripeConnectAccountId,
      status: realStatus,
      accountLink: creator.stripeAccountLink,
      isReady: isReady,
    };
  } catch (err: any) {
    Logging.error(`Get Stripe Connect status error: ${err.message}`);
    throw err;
  }
};

export const completeStripeConnectOnboarding = async (userId: string) => {
  try {
    const creator = await Creator.findOne({ userId });
    if (!creator) {
      throw new Error("Creator not found");
    }

    if (!creator.stripeConnectAccountId) {
      throw new Error("Stripe Connect account not initiated");
    }

    const isReady = await StripeService.isAccountReady(creator.stripeConnectAccountId);
    const realStatus = isReady ? StripeAccountStatus.ACTIVE : StripeAccountStatus.PENDING;

    const updatedCreator = await Creator.findByIdAndUpdate(
      creator._id,
      {
        stripeAccountStatus: realStatus,
      },
      { new: true }
    );

    return {
      accountId: updatedCreator?.stripeConnectAccountId,
      status: updatedCreator?.stripeAccountStatus,
      accountLink: updatedCreator?.stripeAccountLink,
      isReady: isReady,
    };
  } catch (err: any) {
    Logging.error(`Complete Stripe Connect onboarding error: ${err.message}`);
    throw err;
  }
};

export const getCreatorEarnings = async (userId: string) => {
  try {
    const creator = await Creator.findOne({ userId });
    if (!creator) {
      throw new Error("Creator not found");
    }

    return {
      totalEarnings: creator.totalEarnings,
      totalPayouts: creator.totalPayouts,
      pendingBalance: creator.pendingBalance,
      totalRoomsCreated: creator.totalRoomsCreated,
      activeRooms: creator.activeRooms,
    };
  } catch (err: any) {
    Logging.error(`Get creator earnings error: ${err.message}`);
    throw err;
  }
};
