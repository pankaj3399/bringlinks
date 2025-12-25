import { Iitinerary, ItineraryModel } from "./itinerary.interface";
import Itinerary from "./itinerary.model";
import { ItineraryDocument } from "./itinerary.interface";
import Rooms from "../room.model";
import mongoose from "mongoose";
import { IRoomsDocument } from "../room.interface";
import Logging from "../../../library/logging";

export const getItineraryById = async (_id: string) => {
  try {
    const foundedItinerary = await Itinerary.findItineraryById(_id);

    if (!foundedItinerary) throw new Error("Itinerary not found");
    return foundedItinerary.populate({
      path: "roomId",
      model: "Rooms",
      select:
        "event_name event_type event_typeOther event_location_address event_location event_schedule event_venue_image event_description event_flyer_img",
    });
  } catch (err: any) {
    throw err;
  }
};

export const getItineraryByRoomId = async (roomId: string) => {
  try {
    const foundedItinerary = await Itinerary.findOne({ roomId });

    if (!foundedItinerary) throw new Error("Itinerary not found");
    return foundedItinerary.populate({
      path: "roomId",
      model: "Rooms",
      select:
        "event_name event_type event_typeOther event_location_address event_location event_schedule event_venue_image event_description event_flyer_img",
    });
  } catch (err: any) {
    throw err;
  }
};

export const createItinerary = async (
  itinerary: ItineraryDocument,
  roomId: string
) => {
  try {
    const createdItinerary = await Itinerary.create(itinerary);

    if (!createdItinerary) throw new Error("Itinerary is not created");

    const updatedRoom = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $addToSet: { itinerary: createdItinerary._id },
      }
    ).clone();

    if (!updatedRoom) throw new Error("Room not updated");
    return createdItinerary.populate({
      path: "roomId",
      model: "Rooms",
      select:
        "event_name event_type event_typeOther event_location_address event_location event_schedule event_venue_image event_description event_flyer_img",
    });
  } catch (err: any) {
    Logging.error(err);
    throw err;
  }
};

export const updateItinerary = async (
  _id: string,
  itinerary: ItineraryDocument
) => {
  try {
    const foundedItinerary = await Itinerary.findByIdAndUpdate(
      { _id },
      itinerary,
      { new: true, runValidators: true }
    );
    if (!foundedItinerary) throw new Error("Itinerary not updated");

    return foundedItinerary;
  } catch (err: any) {
    throw err;
  }
};

export const deleteItinerary = async (_id: string, room_Id: string) => {
  try {
    const itineraryId = _id as string;
    const roomId = room_Id as string;

    const foundRoomInItinerary = await Rooms.findByIdAndUpdate(
      { _id: roomId },
      {
        $pull: { itinerary: itineraryId },
      }
    );

    if (!foundRoomInItinerary) throw new Error("Itinerary not found");

    const deletedItinerary = await Itinerary.deleteOne({ _id: itineraryId });

    if (deletedItinerary.deletedCount === 0) throw new Error("Itinerary not deleted");

    return { success: true, deletedCount: deletedItinerary.deletedCount };
  } catch (err: any) {
    throw err;
  }
};
