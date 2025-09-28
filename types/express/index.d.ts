import { IRooms } from "resources/room/room.interface";
import { IUserDocument } from "resources/user/user.interface";

type PaidRoomRequestType = {
  roomId: string;
  userId: string;
  role: string;
};

type WalletRequestType = {
  userId: string;
  name: string;
  email: string;
  walletId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: Partial<IUserDocument>; // Adding the optional 'user' property to the Request interface
      paidRoom?: PaidRoomRequestType;
      wallet?: WalletRequestType;
    }
  }
}
