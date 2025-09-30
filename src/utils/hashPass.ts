import bcrypt from "./bcrypt";
import config from "config";
import Logging from "../library/logging";
import User from "../resources/user/user.model";
import { IUserDocument } from "resources/user/user.interface";
import { validateEnv } from "../../config/validateEnv";

const hashPass = (user: IUserDocument, password: string) => {
  try {
    bcrypt.genSalt(config.get<number>("SaltRounds"), function (err: any, salt: string) {
      bcrypt.hash(password, validateEnv.Saltrounds, async function (err: any, hash: string) {
        if (err) throw new Error("hash not created");
        await User.findByIdAndUpdate(user._id, {
          auth: { ...user.auth, password: hash },
        })
          .clone()
          .exec();
      });
    });
  } catch (err: any) {
    Logging.error(err);
  }
};

export default hashPass;
