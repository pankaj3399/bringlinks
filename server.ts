import "module-alias/register";
import App from "./src/app";
import userController from "./src/resources/user/user.controller";
import roomController from "./src/resources/room/room.controller";
import postController from "./src/resources/post/post.controller";
import ChatController from "./src/resources/chats/chats.controller";
import { validateEnv } from "./config/validateEnv";
import * as dotenv from "dotenv";
import PaidRoomController from "./src/resources/room/paidRooms/paidRoom.controller";
import ItineraryController from "./src/resources/room/itinerary/itinerary.controller";
dotenv.config();

const app = new App(
  [
    new userController(),
    new roomController(),
    new ItineraryController(),
    new PaidRoomController(),
    new postController(),
    new ChatController(),
  ],
  validateEnv.PORT
);

app.listen();
