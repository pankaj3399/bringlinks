import User from "./user.model";
import { IUserDocument, IRoles } from "./user.interface";
import jwt from "../../utils/authentication/jwt.createtoken";
import Logging from "../../library/logging";
import { validateEnv } from "../../../config/validateEnv";

export const registerAdmin = async (userData: any) => {
  try {
    const { auth, adminSecret, ...userProfile } = userData;

    const requiredSecret = validateEnv.ADMIN_REGISTRATION_SECRET;
    if (adminSecret !== requiredSecret) {
      throw new Error("Invalid admin registration secret");
    }

    const foundUser: IUserDocument = await User.findByUsername(auth.username);
    if (foundUser) {
      throw new Error("The given username is already in use");
    }

    const foundEmail = await User.findOne({ "auth.email": auth.email });
    if (foundEmail) {
      throw new Error("The given email is already in use");
    }

    const userToCreate = {
      auth,
      profile: userProfile.profile,
      role: IRoles.ADMIN, // Set as admin
      isVerified: true, // Auto-verify admin
    };

    const createdUser = await User.create(userToCreate);
    Logging.log(`Admin user created: ${createdUser._id}`);
    
    if (!createdUser) throw new Error("Admin registration failed");

    const [token, refreshToken] = jwt.CreateToken({
      _id: createdUser._id,
      role: IRoles.ADMIN,
      username: auth.username,
      email: auth.email,
    });

    const createdUserId = createdUser._id as string;

    const userWithoutPassword = await User.findByIdAndUpdate(
      { _id: createdUserId },
      {
        $set: {
          refreshToken,
        },
      }
    )
      .select("-auth.password -role -refreshToken")
      .clone()
      .exec();

    if (!userWithoutPassword) throw new Error("Admin user not found after creation");

    return [userWithoutPassword, token, refreshToken];
  } catch (err: any) {
    Logging.error(`Admin registration error: ${err.message}`);
    throw err.message;
  }
};





