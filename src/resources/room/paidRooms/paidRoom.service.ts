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
      select: "tickets",
    });

    if (!room) throw new Error("Room not found");

    const populated = (room as any).paidRoom;
    if (populated) {
      return populated;
    }

    let paidRoom = await PaidRoom.findOne({ "tickets.roomId": room._id });
    if (!paidRoom) {
      paidRoom = await PaidRoom.findOne({ roomId: room._id as any });
    }
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

    const selectedTier = paidRoom?.tickets?.pricing?.[0]?.tiers as any;
    if (!selectedTier) {
      throw new Error("Tier is required");
    }

    const paid_Room = await PaidRoom.updateOne(
      { roomId: room_Id },
      {
        $addToSet: {
          paidUsers: paidRoom.paidUsers,
          receiptId,
        },
        $inc: {
          "tickets.totalSold": 1,
          "tickets.totalTicketsAvailable": -1,
          "tickets.pricing.$[elem].sold": 1,
          "tickets.pricing.$[elem].available": -1,
        },
        $set: {
          "tickets.totalRevenue": Array.isArray(paidRoom?.tickets?.pricing)
            ? paidRoom.tickets.pricing.reduce((acc: number, curr: any) => {
                const price = Number(curr?.price ?? 0);
                const sold = Number(curr?.sold ?? 0);
                if (!Number.isFinite(price) || !Number.isFinite(sold))
                  return acc;
                return acc + price * sold;
              }, 0)
            : 0,
        },
      },
      {
        arrayFilters: [{ "elem.tiers": selectedTier }],
      }
    );

    if (!paid_Room) throw new Error("Paid room not found");

    const updatedRoom = await Rooms.findByIdAndUpdate(
      { _id: room_Id },
      {
        $addToSet: { entered_id: user_Id },
      },
      { new: true }
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

    //update room
    const updatedRoom = await Rooms.findByIdAndUpdate(room_Id, {
      paid: true,
      paidRoom: paid_Room._id,
    });

    if (!updatedRoom) throw new Error("Room not updated");

    return paid_Room;
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};

export const createNewPaidRoom = async (
  userId: string,
  roomData: {
    name?: string;
    description?: string;
    isPrivate?: boolean;
    ticketPrice: number;
    maxTickets: number;
    ticketTiers?: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    event_type?: string;
    event_typeOther?: string | null;
    event_name?: string;
    event_location_address?: {
      street_address?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zipcode?: string;
      country?: string;
    };
    event_location?: {
      type?: string;
      coordinates?: number[];
      venue?: string;
    };
    event_description?: string;
    event_schedule?: {
      startDate?: string | Date;
      endDate?: string | Date;
    };
    event_privacy?: string;
  }
) => {
  try {
    const now = new Date();
    const startDate = roomData.event_schedule?.startDate
      ? new Date(roomData.event_schedule.startDate)
      : now;
    const endDate = roomData.event_schedule?.endDate
      ? new Date(roomData.event_schedule.endDate)
      : new Date(now.getTime() + 60 * 60 * 1000);

    const eventType = roomData.event_type || "Other";
    const eventTypeOther =
      eventType === "Other"
        ? roomData.event_typeOther || "Other"
        : (undefined as any);

    const eventName = roomData.event_name || roomData.name || "Untitled Room";
    const eventDescription =
      roomData.event_description || roomData.description || "Description";

    const coords = roomData.event_location?.coordinates || [0, 0];
    const eventLocation = {
      type: roomData.event_location?.type || "Point",
      coordinates: coords,
      venue: roomData.event_location?.venue || "",
    } as any;

    const eventAddress = {
      street_address:
        roomData.event_location_address?.street_address || "123 Test St",
      address_line2: roomData.event_location_address?.address_line2 || "",
      city: roomData.event_location_address?.city || "Test City",
      state: roomData.event_location_address?.state || "CA",
      zipcode: roomData.event_location_address?.zipcode || "94107",
      country: roomData.event_location_address?.country || "US",
    };

    const privacy = roomData.event_privacy || "public";

    const newRoom = await Rooms.create({
      event_admin: [new mongoose.Types.ObjectId(userId)],
      event_type: eventType,
      event_typeOther: eventTypeOther,
      event_name: eventName,
      event_location_address: eventAddress,
      event_location: eventLocation,
      event_description: eventDescription,
      event_schedule: { startDate, endDate },
      event_privacy: privacy,
      paid: true,
      created_user: new mongoose.Types.ObjectId(userId),
    });

    Logging.info(`Created room with paid: ${newRoom.paid}`);

    if (!newRoom) throw new Error("Room not created");

    if (!newRoom.paid) {
      await Rooms.findByIdAndUpdate(newRoom._id, { paid: true });
      newRoom.paid = true;
      Logging.info(`Updated room ${newRoom._id} to paid: true`);
    }

    const mapTierNameToEnum = (name: string): string => {
      const normalized = (name || "").toLowerCase();
      if (normalized.includes("premium") && normalized.includes("vip"))
        return "Premium Vip";
      if (normalized.includes("ultimate") && normalized.includes("vip"))
        return "Ultimate Vip";
      if (normalized.includes("early")) return "Early Bird";
      if (normalized.includes("last")) return "Last Minute";
      if (normalized.includes("vip")) return "Vip";
      return "General Admission";
    };

    const pricing =
      roomData.ticketTiers && roomData.ticketTiers.length > 0
        ? roomData.ticketTiers.map((t) => ({
            tiers: mapTierNameToEnum(t.name),
            title: t.name || "General Admission",
            description: t.name || "General Admission",
            price: t.price,
            total: t.quantity,
            available: t.quantity,
            sold: 0,
            active: true,
          }))
        : [
            {
              tiers: "General Admission",
              title: "General Admission",
              description: "General Admission",
              price: roomData.ticketPrice,
              total: roomData.maxTickets,
              available: roomData.maxTickets,
              sold: 0,
              active: true,
            },
          ];

    const paidRoomData = {
      tickets: {
        ticketsTotal: roomData.maxTickets,
        totalTicketsAvailable: roomData.maxTickets,
        totalSold: 0,
        totalRevenue: 0,
        roomId: newRoom._id,
        pricing,
      },
    };

    const paidRoom = await PaidRoom.create(paidRoomData);

    if (!paidRoom) {
      await Rooms.findByIdAndDelete(newRoom._id);
      throw new Error("Paid room not created");
    }

    await Rooms.findByIdAndUpdate(newRoom._id, {
      paidRoom: paidRoom._id,
    });

    return {
      room: newRoom,
      paidRoom: paidRoom,
    };
  } catch (err) {
    Logging.error(err);
    throw err;
  }
};
