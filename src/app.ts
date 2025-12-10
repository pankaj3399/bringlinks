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
import {
  createMessageWithMedia,
  editMessage,
  deleteMessage,
} from "./resources/chats/chats.service";
import { ChatTypes, IChatsDocument } from "./resources/chats/chats.interface";
import Chats from "./resources/chats/chats.model";
import fileUpload from "express-fileupload";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "./resources/user/user.model";
import { validateEnv as env } from "../config/validateEnv";
import stripeWebhook from "./resources/user/creator/stripe.webhook";

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
        origin: validateEnv.BASE_URL || "*", // Replace with front-end URL
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true,
      },
    });
    this.port = port;
    this.initializeMiddleware();
    this.initializePassport();
    this.initializeDatabaseConnection();
    this.initializeSocket(this.io);
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
  }
  private initializeMiddleware(): void {

    this.express.use(
      "/stripe/webhook",
      bodyParser.raw({ 
        type: "application/json",
        verify: (req: any, res, buf, encoding) => {
          req.rawBody = buf;
        }
      }),
      stripeWebhook
    );
    
    // Now apply all other middleware normally
    this.express.use(compression());
    this.express.use(
      fileUpload({
        limits: { fileSize: 50 * 1024 * 1024 },
        useTempFiles: true,
        tempFileDir: require("os").tmpdir(),
        abortOnLimit: true,
      })
    );
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(bodyParser.json());
    this.express.use(cors());
    this.express.use(cookieParser());
    this.express.use(morgan("dev"));
    this.express.use(
      session({
        secret: env.COOKIE,
        resave: false,
        saveUninitialized: false,
      })
    );
    this.express.use(passport.initialize());
    this.express.use(passport.session());
    this.express.set("passport", passport);
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
  private initializePassport(): void {
    passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
      done(null, user._id?.toString?.() || user.id);
    });
    passport.deserializeUser(
      async (
        id: string,
        done: (err: any, user?: any | false | null) => void
      ) => {
        try {
          const user = await User.findById(id).select(
            "-auth.password -refreshToken"
          );
          done(null, user);
        } catch (e) {
          done(e as any, null);
        }
      }
    );

    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: any,
          done: (err: any, user?: any, info?: any) => void
        ) => {
          try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value?.toLowerCase();
            const firstName = profile.name?.givenName || "";
            const lastName = profile.name?.familyName || "";

            let user = await User.findOne({
              $or: [{ googleId }, { "auth.email": email }],
            }).exec();
            if (!user) {
              const safeUsername = `google_${String(googleId || "user").slice(
                0,
                24
              )}`;
              user = await User.create({
                auth: {
                  username: safeUsername,
                  password:
                    Math.random().toString(36).slice(2) +
                    Math.random().toString(36).slice(2),
                  email,
                },
                profile: {
                  firstName: firstName || "Google",
                  lastName: lastName || "User",
                  birthDate: new Date("2000-01-01T00:00:00Z"),
                },
                isVerified: true,
                googleId,
              } as any);
            } else if (!(user as any).googleId) {
              (user as any).googleId = googleId;
              await user.save();
            }
            return done(null, user);
          } catch (err) {
            return done(err as any, undefined);
          }
        }
      )
    );
  }
  private initializeSocket(io: Server): void {
    let connectionCount = 0;

    (io as any).on("connection", (socket: Socket) => {
      connectionCount++;

      Logging.log(
        `A user connected: ${socket.id} (Total connections: ${connectionCount})`
      );

      socket.on("error", (error: unknown) => {
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
          groupId,
          message,
          chatType,
          media,
          replyTo,
        }: any) => {
          try {
            const messageData = {
              sender,
              receiver,
              roomId: room_Id,
              groupId,
              message,
              chatType,
              media,
              replyTo,
            };

            const newMessage = await createMessageWithMedia(messageData);

            if (newMessage) {
              if (chatType === ChatTypes.user && receiver) {
                io.to(receiver as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
                io.to(sender as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              } else if (chatType === ChatTypes.group && groupId) {
                io.to(groupId as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              } else if (chatType === ChatTypes.room && room_Id) {
                io.to(room_Id as unknown as string).emit(
                  "receiveMessage",
                  newMessage
                );
              }

              socket.emit("receiveMessage", newMessage);
            }
          } catch (error) {
            socket.emit("messageError", { error: "Failed to send message" });
          }
        }
      );

      socket.on("editMessage", async ({ messageId, newMessage, userId }) => {
        try {
          const updatedMessage = await editMessage(
            messageId,
            newMessage,
            userId
          );

          if (updatedMessage) {
            if (
              updatedMessage.chatType === ChatTypes.user &&
              updatedMessage.receiver
            ) {
              io.to(updatedMessage.receiver as unknown as string).emit(
                "messageEdited",
                updatedMessage
              );
              io.to(updatedMessage.sender as unknown as string).emit(
                "messageEdited",
                updatedMessage
              );
            } else if (
              updatedMessage.chatType === ChatTypes.group &&
              updatedMessage.group
            ) {
              io.to(updatedMessage.group as unknown as string).emit(
                "messageEdited",
                updatedMessage
              );
            } else if (
              updatedMessage.chatType === ChatTypes.room &&
              updatedMessage.room_Id
            ) {
              io.to(updatedMessage.room_Id as unknown as string).emit(
                "messageEdited",
                updatedMessage
              );
            }
          }
        } catch (error) {
          socket.emit("messageError", { error: "Failed to edit message" });
        }
      });

      socket.on("deleteMessage", async ({ messageId, userId }) => {
        try {
          const success = await deleteMessage(messageId, userId);

          if (success) {
            const message = await Chats.findById(messageId);
            if (message) {
              if (message.chatType === ChatTypes.user && message.receiver) {
                io.to(message.receiver as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
                io.to(message.sender as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
              } else if (
                message.chatType === ChatTypes.group &&
                message.group
              ) {
                io.to(message.group as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
              } else if (
                message.chatType === ChatTypes.room &&
                message.room_Id
              ) {
                io.to(message.room_Id as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
              }
            }
          }
        } catch (error) {
          socket.emit("messageError", { error: "Failed to delete message" });
        }
      });

      socket.on("disconnect", () => {
        connectionCount--;
        Logging.log(
          `A user disconnected: ${socket.id} (Total connections: ${connectionCount})`
        );
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
    mongoose.connect(`mongodb+srv://${Mongo_User}:${Mongo_Pass}@${Mongo_Path}/bringlinks`);

    mongoose.connection.on("connected", () => {
      Logging.info(
        `Successful connection to Database: ${Mongo_Path}`
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
