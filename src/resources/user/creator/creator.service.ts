import Creator from "./creator.model";
import User from "../user.model";
import { validateAndUseSignupCode } from "../../signupCode/signupCode.service";
import {
  ICreatorRegistrationRequest,
  ICreatorSignupRequest,
  StripeAccountStatus,
} from "./creator.interface";
import { validateEnv } from "../../../../config/validateEnv";
import Logging from "../../../library/logging";
import bcrypt from "bcrypt";
import jwt from "../../../utils/authentication/jwt.createtoken";
import StripeService from "../../../utils/stripe/stripe.service";
import { parseAllowedStates } from "../../../utils/parseStates/allowedStates";

export const signupAsCreator = async (creatorData: ICreatorSignupRequest) => {
  try {
    const { email, password, firstName, lastName, state, signupCode } =
      creatorData;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Signup code is required for all creator signups
    if (!signupCode) {
      throw new Error("Signup code is required for creator signup");
    }

    const allowedStates = parseAllowedStates();
    const isFromAllowedState = allowedStates.includes(
      state.trim().toLowerCase()
    );

    if (!isFromAllowedState) {
      throw new Error("Creator registration not available in your state");
    }

    // Validate and use signup code
    const codeConsumed = await validateAndUseSignupCode(signupCode);
    if (!codeConsumed) {
      throw new Error(
        "Invalid signup code or code has reached maximum usage limit"
      );
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
    });

    if (!creator) {
      await User.findByIdAndDelete(user._id);
      throw new Error("Creator registration failed");
    }

    await User.findByIdAndUpdate(user._id, {
      role: "CREATOR",
      creator: creator._id,
    });

    const [accessToken, refreshToken] = jwt.CreateToken({
      userId: user._id.toString(),
    });

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
        stripeAccountStatus: creator.stripeAccountStatus,
      },
      token: accessToken,
      refreshToken,
    };
  } catch (err: any) {
    Logging.error(`Creator signup error: ${err.message}`);
    throw err;
  }
};

export const registerCreator = async (
  creatorData: ICreatorRegistrationRequest
) => {
  try {
    const { userId } = creatorData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const signupCode = user.signupCode;

    // Signup code is required for all creator registrations
    if (!signupCode) {
      throw new Error("Signup code is required for creator registration");
    }

    const allowedStates = parseAllowedStates();
    const isFromAllowedState =
      user.state && allowedStates.includes(user.state.trim().toLowerCase());

    if (!isFromAllowedState) {
      throw new Error("Creator registration not available in your state");
    }

    // Validate and use signup code
    const codeConsumed = await validateAndUseSignupCode(signupCode);
    if (!codeConsumed) {
      throw new Error(
        "Invalid signup code or code has reached maximum usage limit"
      );
    }

    const existingCreator = await Creator.findOne({ userId });
    if (existingCreator) {
      throw new Error("User is already registered as creator");
    }

    const creator = await Creator.create({
      userId,
      signupCode,
    });

    if (!creator) {
      throw new Error("Creator registration failed");
    }

    await User.findByIdAndUpdate(userId, {
      role: "CREATOR",
      creator: creator._id,
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
    //uncomment follwing if you want to allow creator to create paid room without creating stripe connect account
    if ((validateEnv.FORCE_CREATOR_ELIGIBLE || "").toString().toLowerCase() === "true") {
      return { canCreate: true };
    }

    const creator = await Creator.findOne({ userId });

    if (!creator) {
      return {
        canCreate: false,
        reason: "Creator account not found",
        action: "register_as_creator",
      };
    }

    if (!creator.stripeConnectAccountId) {
      return {
        canCreate: false,
        reason: "Stripe Connect account required",
        redirectTo: "/creator/stripe-connect/onboard",
        action: "redirect_to_stripe_connect",
      };
    }

    if (creator.stripeAccountStatus !== StripeAccountStatus.ACTIVE) {
      return {
        canCreate: false,
        reason: "Stripe Connect account not active",
        redirectTo: "/creator/stripe-connect/onboard",
        action: "redirect_to_stripe_connect",
      };
    }

    return {
      canCreate: true,
    };
  } catch (err: any) {
    Logging.error(`Can create paid rooms check error: ${err.message}`);
    throw err;
  }
};

export const getReviewsByCreatorId = async (creatorId: string) => {
  try {
    const reviews = await Creator.find({ creatorId }).select("reviews");

    return reviews;
  } catch (err: any) {
    Logging.error(`Get reviews by creator ID error: ${err.message}`);
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

export const updateCreatorProfile = async (
  creatorId: string,
  updateData: Partial<ICreatorRegistrationRequest>
) => {
  try {
    return await Creator.findByIdAndUpdate(creatorId, updateData, {
      new: true,
    });
  } catch (err: any) {
    Logging.error(`Update creator profile error: ${err.message}`);
    throw err;
  }
};

export const initiateStripeConnectOnboarding = async (
  userId: string,
  returnUrl: string,
  refreshUrl: string
) => {
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
        "US"
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

    const isReady = await StripeService.isAccountReady(
      creator.stripeConnectAccountId
    );
    const realStatus = isReady
      ? StripeAccountStatus.ACTIVE
      : StripeAccountStatus.PENDING;

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

    const isReady = await StripeService.isAccountReady(
      creator.stripeConnectAccountId
    );
    const realStatus = isReady
      ? StripeAccountStatus.ACTIVE
      : StripeAccountStatus.PENDING;

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
