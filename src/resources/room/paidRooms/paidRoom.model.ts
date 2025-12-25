import { model, Schema } from "mongoose";
import { Tiers, IPaidRooms } from "./paidRoom.interface";
import { kMaxLength } from "buffer";

export const PaidRoomSchema = new Schema<IPaidRooms>(
  {
    tickets: {
      totalRevenue: {
        type: Number,
        required: function () {
          var room = this as IPaidRooms;
          return room?.isModified("ticketsSold") ? true : false;
        },
      },
      totalTicketsAvailable: {
        type: Number,
        required: true,
        default: 0,
      },
      totalSold: {
        type: Number,
        required: true,
        default: 0,
      },
      ticketsTotal: {
        type: Number,
        required: true,
      },
      pricing: [
        {
          tiers: {
            type: String,
            enum: Tiers,
            required: true,
          },
          description: {
            type: String,
            required: true,
            maxLength: 255,
          },
          title: {
            type: String,
            required: true,
            maxLength: 60,
          },
          price: {
            type: Number,
            required: true,
          },
          available: {
            type: Number,
            required: true,
          },
          sold: {
            type: Number,
            required: true,
          },
          active: {
            type: Boolean,
            required: true,
          },
          total: {
            type: Number,
            required: true,
          },
        },
      ],
      receiptId: [
        {
          type: String,
          required: true,
        },
      ],
      refreshToken: {
        type: String,
      },
      paid: {
        type: Boolean,
        default: false,
        required: false,
      },
      paidUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      roomId: {
        type: Schema.Types.ObjectId,
        ref: "Rooms",
      },
    },
  },
  { timestamps: true, minimize: false }
);

PaidRoomSchema.index({ "tickets.ticketsAvailable": 1, _id: 1 });
PaidRoomSchema.index({ "tickets.pricing": 1, _id: 1 });
PaidRoomSchema.index({ receiptId: 1, _id: 1 });

PaidRoomSchema.pre("save", function (next) {
  //check if room is created and tickets.totalTicketsAvailable is greater than 0

  if (!this.isModified("tickets.ticketsTotal")) {
    return next();
  }

  this.tickets.totalRevenue = this.tickets.pricing.reduce(
    (acc, curr) => acc + curr.price * curr.sold,
    0
  );
  this.tickets.totalTicketsAvailable = this.tickets.pricing.reduce(
    (acc, curr) => acc + curr.total,
    0
  );
  this.tickets.totalSold = 0;

  next();
});
const PaidRoom = model<IPaidRooms>("PaidRooms", PaidRoomSchema);
export default PaidRoom;
