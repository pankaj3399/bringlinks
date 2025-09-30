import Logging from "../../../library/logging";
import Rooms from "../room.model";
import PaidRoom from "./paidRoom.model";
import { IPaidRooms } from "./paidRoom.interface";
import mongoose from "mongoose";

export const getPaidRoom = async (roomId: string) => {
  try {
    const room = await Rooms.findById(roomId).populate({
      path: "paidRoom",
      model: "PaidRooms",
      select: "-receiptId ",
    });

    if (!room) throw new Error("Room not found");

    const paidRoom = await PaidRoom.findOne({ roomId: room._id });
    if (!paidRoom) throw new Error("Paid room not found");

    return paidRoom;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const buyTickets = async (
  userId: string,
  paidRoom: IPaidRooms,
  receiptId: string
) => {
  try {
    const room_Id = paidRoom.roomId?.toString() as string;
    const user_Id = userId as string;
    const foundRoom = await Rooms.findById(room_Id);

    if (!foundRoom || !foundRoom.paid) throw new Error("Room not found");

    const paid_Room = await PaidRoom.updateOne(
      { roomId: room_Id },
      {
        $addToSet: {
          paidUsers: paidRoom.paidUsers,
          receiptId,
          tickets: {
            pricing: {
              $eq: {
                tiers: paidRoom.tickets.pricing[0].tiers,
                $inc: {
                  sold: 1,
                  available: -1,
                },
              },
            },
          },
        },
        $set: {
          tickets: {
            $inc: {
              totalSold: 1,
              totalTicketsAvailable: -1,
            },
            totalRevenue: paidRoom.tickets.pricing.reduce(
              (acc, curr) => acc + curr.price * curr.sold,
              0
            ),
          },
        },
      }
    );

    if (!paid_Room) throw new Error("Paid room not found");

    const updatedRoom = await Rooms.findByIdAndUpdate(
      { _id: room_Id },
      {
        $addToSet: { entered_id: user_Id },
      }
    ).populate({
      path: "paidRoom",
      model: "PaidRooms",
      select: "-receiptId",
    });

    if (!updatedRoom) throw new Error("Room not updated");

    return {
      updatedRoom,
      paidRoom: paid_Room,
    };
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const updatePaidRoom = async (room: IPaidRooms) => {
  try {
    const foundRoom = await Rooms.findById(room.roomId);
    if (!foundRoom) throw new Error("Paid room not found");

    const updatedRoom = await PaidRoom.updateOne(
      { _id: room._id },
      room
    ).populate({
      path: "roomId",
      model: "Rooms",
      select: "-paidRoom",
    });

    if (!updatedRoom) throw new Error("Paid room not updated");
    return updatedRoom;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const deletePaidRoom = async (roomId: string) => {
  try {
    const roomIdToDelete = roomId as string;
    const foundRoom = await Rooms.findById(roomIdToDelete);
    if (!foundRoom) throw new Error("Paid room not found");

    await PaidRoom.deleteOne({ _id: foundRoom.paidRoom });

    const updatedRooms = await Rooms.updateOne(
      { _id: roomIdToDelete },
      {
        $pull: { paidRoom: roomIdToDelete },
      }
    );

    if (!updatedRooms) throw new Error("Paid room not updated");

    return foundRoom;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

// reflect when a user ask for a refund
export const returnPaidRoom = async (userId: string, paidRoom: IPaidRooms) => {
  try {
    const room_Id = paidRoom.roomId?.toString() as string;
    const user_Id = userId as string;

    const foundRoom = await PaidRoom.updateOne(
      {
        roomId: room_Id,
        _id: paidRoom._id,
      },
      {
        // reflect when a user ask for a refund
        tickets: {
          $inc: {
            totalTicketsAvailable: 1,
            totalSold: -1,
          },
          $pull: {
            paidUsers: user_Id,
            receiptId: paidRoom.receiptId,
          },
          pricing: {
            $eq: {
              tiers: paidRoom.tickets.pricing[0].tiers,
              $inc: {
                sold: -1,
                available: 1,
              },
            },
          },
        },
      }
    );

    if (!foundRoom) throw new Error("Room not found");

    const updatedRoom = await Rooms.findByIdAndUpdate(
      { _id: room_Id },
      {
        $pull: { entered_id: user_Id },
      }
    ).populate({
      path: "paidRoom",
      model: "PaidRooms",
      select: "-receiptId ",
    });

    if (!updatedRoom) throw new Error("Room not updated");

    return {
      updatedRoom,
      paidRoom,
    };
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const addTickets = async (roomId: string, paidRoom: IPaidRooms) => {
  try {
    const room_Id = roomId as string;
    const foundRoom = await Rooms.findById(room_Id);

    if (!foundRoom) throw new Error("Room not found");

    const paid_Room = await PaidRoom.create({
      roomId: room_Id,
      tickets: {
        ticketsTotal: paidRoom.tickets.ticketsTotal,
        $addToSet: {
          pricing: paidRoom.tickets.pricing,
        },
      },
    });

    if (!paid_Room) throw new Error("Paid room not created");

    return paid_Room;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const createPaidRoom = async (
  roomId: string,
  paidRoom: Partial<IPaidRooms>
) => {
  try {
    const room_Id = roomId as string;
    const foundRoom = await Rooms.findById(room_Id);

    if (!foundRoom) throw new Error("Room not found");

    const paid_Room = await PaidRoom.create({
      roomId: room_Id,
      tickets: {
        ticketsTotal: paidRoom.tickets?.ticketsTotal,
        $addToSet: {
          pricing: paidRoom.tickets?.pricing,
        },
      },
    });

    if (!paid_Room) throw new Error("Paid room not created");

    return paid_Room;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};