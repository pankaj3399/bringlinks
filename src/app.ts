import express, { Application, RequestHandler } from "express";
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
import { ChatTypes } from "./resources/chats/chats.interface";
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
        origin: validateEnv.BASE_URL, // Replace with front-end URL
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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
        limits: { fileSize: 300 * 1024 * 1024 },
        useTempFiles: false,
        abortOnLimit: true,
      })
    );
    // Stripe webhook needs raw body for signature verification
    this.express.use(
      "/stripe/webhook",
      express.raw({ type: "application/json" })
    );
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(bodyParser.json());
    this.express.use(
      cors({
        origin: (origin, callback) => {
          const allowedOrigins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8080",
            "https://staging.bringinglinkups.com",
            "https://www.bringinglinkups.com",
            "https://bringinglinkups.com",
            "https://www.admin.bringinglinkups.com",
          ];

          // Add BASE_URL from environment
          if (
            validateEnv.BASE_URL &&
            !allowedOrigins.includes(validateEnv.BASE_URL)
          ) {
            allowedOrigins.push(validateEnv.BASE_URL);
          }

          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin) {
            Logging.info(`CORS origin is ${origin}`);
            return callback(null, true);
          }

          // Check if origin is allowed
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            Logging.error(`❌ CORS blocked origin: ${origin}`);
            callback(new Error("Not allowed by CORS"));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Request-Time",
          "my-custom-header",
        ],
        credentials: true,
      })
    );
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
          Logging.log(
            `updatedMessage: ${updatedMessage} connectionCount: ${connectionCount}`
          );
          socket.emit("messageEdited", updatedMessage);

          if (updatedMessage) {
            if (
              updatedMessage.chatType === ChatTypes.user &&
              updatedMessage.receiver
            ) {
              const senderRoom = updatedMessage.sender.toString();
              const receiverRoom = updatedMessage.receiver.toString();
              io.to(senderRoom).emit("messageEdited", updatedMessage);
              io.to(receiverRoom).emit("messageEdited", updatedMessage);

              Logging.log(
                `✅ Message edited emitted to rooms: ${senderRoom}, ${receiverRoom}`
              );
            } else if (
              updatedMessage.chatType === ChatTypes.group &&
              updatedMessage.group
            ) {
              const groupRoom = updatedMessage.group.toString();
              io.to(groupRoom).emit("messageEdited", updatedMessage);
              Logging.log(
                `✅ Message edited emitted to group room: ${groupRoom}`
              );
            } else if (
              updatedMessage.chatType === ChatTypes.room &&
              updatedMessage.room_Id
            ) {
              const roomId = updatedMessage.room_Id.toString();
              io.to(roomId).emit("messageEdited", updatedMessage);
              Logging.log(`✅ Message edited emitted to room: ${roomId}`);
            }
          }
        } catch (error) {
          socket.emit("messageError", { error: "Failed to edit message" });
        }
      });

      socket.on("deleteMessage", async ({ messageId, userId }) => {
        try {
          const success = await deleteMessage(messageId, userId);
          Logging.log(`success: ${success}`);

          if (success) {
            const message = await Chats.findById(messageId);
            Logging.log(
              `message in deleteMessage: ${message} connectionCount: ${connectionCount}`
            );
            socket.emit("messageDeleted", { messageId });
            if (message) {
              if (message.chatType === ChatTypes.user && message.receiver) {
                Logging.log(
                  `message.receiver in deleteMessage: ${message.receiver}`
                );
                Logging.log(
                  `message.sender in deleteMessage: ${message.sender.toString()}`
                );
                io.to(message.receiver as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
                Logging.log(`messageId in deleteMessage: ${messageId}`);
                io.to(message.sender as unknown as string).emit(
                  "messageDeleted",
                  { messageId }
                );
                const senderRoom = message.sender.toString();
                const receiverRoom = message.receiver.toString();

                Logging.log(
                  `Emitting delete to rooms: ${senderRoom}, ${receiverRoom}`
                );
                io.to(senderRoom).emit("messageDeleted", {
                  messageId,
                  sender: message.sender,
                  receiver: message.receiver,
                  chatType: message.chatType,
                });
                io.to(receiverRoom).emit("messageDeleted", {
                  messageId,
                  sender: message.sender,
                  receiver: message.receiver,
                  chatType: message.chatType,
                });

                Logging.log(
                  `✅ Message deleted emitted to rooms: ${senderRoom}, ${receiverRoom}`
                );
              } else if (
                message.chatType === ChatTypes.group &&
                message.group
              ) {
                const groupRoom = message.group.toString();
                io.to(groupRoom).emit("messageDeleted", {
                  messageId,
                  group: message.group,
                  chatType: message.chatType,
                });
                Logging.log(
                  `✅ Message deleted emitted to group room: ${groupRoom}`
                );
              } else if (
                message.chatType === ChatTypes.room &&
                message.room_Id
              ) {
                const roomId = message.room_Id.toString();
                io.to(roomId).emit("messageDeleted", {
                  messageId,
                  room_Id: message.room_Id,
                  chatType: message.chatType,
                });
                Logging.log(`✅ Message deleted emitted to room: ${roomId}`);
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
    mongoose
      .connect(`mongodb+srv://${Mongo_User}${Mongo_Pass}${Mongo_Path}`, {
        maxPoolSize: 5,
        minPoolSize: 1,
      })
      .then(() => {
        Logging.info("Successfully Connected to Database");
      })
      .catch((err) => {
        Logging.error(`Initial connection failed:, ${err}`);
        process.exit(1);
      });

    mongoose.connection.on("connected", () => {
      const appName = Mongo_Path.split("&")[2].split("=")[1];
      Logging.info(`Connection to ${appName} Database`);
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
    try {
      this.Http.listen(this.port, () => {
        Logging.info(`App is up and running on this port: ${this.port}`);
      });
    } catch (err) {
      Logging.log(`Listening Error: ${err}`);
      process.exit(1);
    }
  }
}

export default App;
