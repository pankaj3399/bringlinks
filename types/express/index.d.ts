import { IRooms } from "resources/room/room.interface";
import { IRoles } from "resources/user/user.interface";

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
    interface User {
      _id: string;
      role?: IRoles;
      name?: string;
      email?: string;
    }

    interface Request {
      paidRoom?: PaidRoomRequestType;
      wallet?: WalletRequestType;
    }
  }
}
