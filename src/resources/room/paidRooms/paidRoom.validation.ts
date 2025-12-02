import Joi from "joi";
import { IPaidRooms, Tiers } from "./paidRoom.interface";

const buyTickets = Joi.object<Pick<IPaidRooms, "tickets">>({
  tickets: Joi.array().items(
    Joi.object({
      pricing: Joi.array().items(
        Joi.object({
          tiers: Joi.string<Tiers>().required(),
        })
      ),
      paidUsers: Joi.array().items(Joi.string().required()),
      roomId: Joi.string(),
    })
  ),
});

const updatePaidRoom = Joi.object<Partial<IPaidRooms>>({
  tickets: Joi.object({
    ticketsTotal: Joi.number(),
    pricing: Joi.array().items(
      Joi.object({
        tiers: Joi.string<Tiers>(),
        description: Joi.string(),
        title: Joi.string(),
        total: Joi.number(),
        active: Joi.boolean(),
      })
    ),
  }),
});

const createPaidRoom = Joi.object<Partial<IPaidRooms>>({
  tickets: Joi.object({
    roomId: Joi.string().required(),
    ticketsTotal: Joi.number().required(),
    pricing: Joi.array().items(
      Joi.object({
        tier: Joi.string<Tiers>().required(),
        total: Joi.number().required(),
        title: Joi.string().required(),
        description: Joi.string().required(),
        price: Joi.number().required(),
        active: Joi.boolean().required(),
        available: Joi.number().required(),
      })
    ),
  }),
});

const addTickets = Joi.object<Partial<IPaidRooms>>({
  tickets: Joi.object({
    roomId: Joi.string().required(),
    ticketsTotal: Joi.number().required(),
    pricing: Joi.array().items(
      Joi.object({
        tier: Joi.string<Tiers>().required(),
        title: Joi.string().required(),
        description: Joi.string().required(),
        total: Joi.number().required(),
        price: Joi.number().required(),
        active: Joi.boolean().required(),
        available: Joi.number().required(),
      })
    ),
  }),
});

export default {
  createPaidRoom,
  updatePaidRoom,
  addTickets,
  buyTickets,
};
