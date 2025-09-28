import express, { Application } from "express";
import http, { IncomingMessage, ServerResponse } from "http";
import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import Logging from "./library/logging";
import ErrorMiddleware from "./middleware/error.middleware";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import Controller from "./utils/interfaces/controller.interface";
import { validateEnv } from "../config/validateEnv";
import { createMessage } from "./resources/chats/chats.service";
import { ChatTypes, IChatsDocument } from "./resources/chats/chats.interface";
import fileUpload from "express-fileupload";

class App {
  public express: Application;
  public port: number;
  private Http: http.Server<typeof IncomingMessage, typeof ServerResponse>;
  public io: Server;

  constructor(controllers: Controller[], port: number) {
    this.express = express();
    this.Http = http.createServer(this.express);
    this.io = new Server(this.Http, {
      cors: {
        origin: "*", // Replace with front-end URL
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true,
      },
    });
    this.port = port;
    this.initializeMiddleware();
    this.initializeDatabaseConnection();
    this.initializeSocket(this.io);
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
  }
  private initializeMiddleware(): void {
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(bodyParser.json());
    this.express.use(cors());
    this.express.use(cookieParser());
    this.express.use(morgan("dev"));
    this.express.use(compression());
    this.express.use(fileUpload());
    this.express.set("io", this.io);
    this.express.use((req, res, next) => {
      /* Log the req */
      Logging.info(
        `Incoming - METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}]`
      );

      res.on("finish", () => {
        /* Log the res */
        Logging.info(
          `Result - METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}] - STATUS: [${res.statusCode}]`
        );
      });
      next();
    });
  }
  private initializeSocket(io: Server): void {
    io.on("connection", (socket: Socket) => {
      Logging.log("User connected");
      // When a user connects, log them in
      Logging.log(`A user connected: ${socket.id}`);

      socket.on("error", (error) => {
        Logging.error(`Socket error: ${error}`);
      });

      // Join user to a room based on their userId or roomId or groupId
      socket.on("join", (roomId: string | string[]) => {
        socket.join(roomId);
        Logging.log(`User joined room: ${roomId}`);
      });

      // Listen for messages in different chat types
      socket.on(
        "sendMessage",
        async ({
          sender,
          receiver,
          room_Id,
          message,
          chatType,
        }: IChatsDocument) => {
          try {
            const newMessage = await createMessage({
              sender,
              receiver,
              room_Id,
              message,
              chatType,
            } as IChatsDocument);

            const groupId = newMessage?.group;

            if (newMessage) {
              if (chatType === ChatTypes.user && receiver) {
                // Emit the message to the user in a user-to-user chat
                io.to(receiver as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              } else if (chatType === ChatTypes.group && groupId) {
                // Emit the message to all group members
                io.to(groupId as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              } else if (chatType === ChatTypes.room && room_Id) {
                // Emit the message to all room participants
                io.to(room_Id as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              }
            }
          } catch (error) {
            Logging.error(`Error sending message: ${error}`);
          }
        }
      );

      socket.on("disconnect", () => {
        Logging.log(`A user disconnected: ${socket.id}`);
      });
    });
    Logging.log(`Socket is ready`);
  }
  private initializeControllers(controllers: Controller[]): void {
    controllers.forEach((controller: Controller) => {
      this.express.use(controller.router);
    });
  }
  private initializeDatabaseConnection(): void {
    const { Mongo_User, Mongo_Pass, Mongo_Path } = validateEnv;
    mongoose.set("strictQuery", false);
    mongoose.connect(`mongodb+srv://${Mongo_User}${Mongo_Pass}${Mongo_Path}`);

    mongoose.connection.on("connected", () => {
      Logging.info(
        `Successful connection to Database: ${Mongo_Path.split("&")[2]}`
      );
    });
    mongoose.connection.on("error", (err) => {
      Logging.error(err);
      process.exit(1);
    });
  }
  private initializeErrorHandling(): void {
    this.express.use(ErrorMiddleware);
  }
  public listen() {
    this.Http.listen(this.port, () => {
      Logging.info(`App is up and running on this port: ${this.port}`);
    });
  }
}

export default App;
