import { model, Schema } from "mongoose";
import { IFriends } from "./friends.interface";

const friendSchema = new Schema<IFriends>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  friendId: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Friend = model<IFriends>("Friend", friendSchema);
export default Friend;
