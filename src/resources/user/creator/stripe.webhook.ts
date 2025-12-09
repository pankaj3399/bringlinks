import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { validateEnv } from "../../../../config/validateEnv";
import Creator from "./creator.model";
import Logging from "../../../library/logging";
import { StripeAccountStatus } from "./creator.interface";
import PaidRoom from "../../room/paidRooms/paidRoom.model";
import Rooms from "../../room/room.model";
import { createEntryQRCode } from "../../room/room.service";
import UserReceipt from "../../receipt/receipt.model";
import { PaymentStatus } from "../../receipt/receipt.interface";

const stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2025-10-29.clover",
});

const router = Router();

router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = validateEnv.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    Logging.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "capability.updated":
        await handleCapabilityUpdated(event.data.object as Stripe.Capability);
        break;
      default:
        Logging.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    Logging.error(`Webhook handler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

async function handleAccountUpdated(account: Stripe.Account) {
  try {
    const creator = await Creator.findOne({
      stripeConnectAccountId: account.id,
    });
    if (!creator) {
      Logging.log(`No creator found for Stripe account: ${account.id}`);
      return;
    }

    const isReady =
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.capabilities?.card_payments === "active" &&
      account.capabilities?.transfers === "active";

    const newStatus = isReady
      ? StripeAccountStatus.ACTIVE
      : StripeAccountStatus.PENDING;

    if (creator.stripeAccountStatus !== newStatus) {
      await Creator.findByIdAndUpdate(creator._id, {
        stripeAccountStatus: newStatus,
      });

      Logging.log(
        `Creator ${creator._id} Stripe status updated to: ${newStatus}`
      );
    }
  } catch (error: any) {
    Logging.error(`Handle account updated error: ${error.message}`);
  }
}

async function handleCapabilityUpdated(capability: Stripe.Capability) {
  try {
    const accountId = capability.account as string;
    const creator = await Creator.findOne({
      stripeConnectAccountId: accountId,
    });
    if (!creator) {
      Logging.log(`No creator found for Stripe account: ${accountId}`);
      return;
    }

    const account = await stripe.accounts.retrieve(accountId);
    const isReady =
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.capabilities?.card_payments === "active" &&
      account.capabilities?.transfers === "active";

    const newStatus = isReady
      ? StripeAccountStatus.ACTIVE
      : StripeAccountStatus.PENDING;

    if (creator.stripeAccountStatus !== newStatus) {
      await Creator.findByIdAndUpdate(creator._id, {
        stripeAccountStatus: newStatus,
      });

      Logging.log(
        `Creator ${creator._id} Stripe status updated to: ${newStatus} after capability update`
      );
    }
  } catch (error: any) {
    Logging.error(`Handle capability updated error: ${error.message}`);
  }
}

export default router;

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const metadata = (session.metadata || {}) as Record<string, string>;
    const roomId = metadata.roomId;
    const userId = metadata.userId;
    const tierTitle = metadata.tierTitle;
    const quantity = parseInt(metadata.quantity || "1", 10) || 1;

    if (!roomId || !userId) {
      Logging.error(`Missing metadata - roomId: ${roomId}, userId: ${userId}`);
      return;
    }

    const paidRoom = await PaidRoom.findOne({ "tickets.roomId": roomId });
    if (!paidRoom) {
      Logging.error(`PaidRoom not found for roomId: ${roomId}`);
      return;
    }

    const pricing = paidRoom.tickets?.pricing || ([] as any[]);
    const idx = pricing.findIndex(
      (p: any) => p.title === tierTitle || p.tiers === tierTitle
    );

    if (idx === -1) {
      Logging.error(
        `Tier "${tierTitle}" not found! Available tiers: ${pricing
          .map((p: any) => p.title)
          .join(", ")}`
      );
      return;
    }

    const target = pricing[idx];

    if (target.available < quantity) {
      Logging.error(
        `Insufficient tickets! Requested: ${quantity}, Available: ${target.available}`
      );
      return;
    }

    target.sold = (target.sold || 0) + quantity;
    target.available = Math.max(0, target.available - quantity);

    const revenue = target.price * quantity;
    paidRoom.tickets.totalRevenue =
      (paidRoom.tickets.totalRevenue || 0) + revenue;

    if (!paidRoom.tickets.receiptId) {
      paidRoom.tickets.receiptId = [];
    }
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (pi) {
      (paidRoom.tickets.receiptId as any).push(pi);
    }

    if (!paidRoom.tickets.paidUsers) {
      paidRoom.tickets.paidUsers = [];
    }
    if (!paidRoom.tickets.paidUsers.some((id) => id.toString() === userId)) {
      (paidRoom.tickets.paidUsers as any).push(userId);
    }

    paidRoom.markModified("tickets");

    await paidRoom.save();

    // Add user to the Room's entered_id array
    try {
      await Rooms.updateOne(
        { _id: roomId },
        { $addToSet: { entered_id: userId } }
      );
      Logging.log(`User ${userId} added to entered_id for room ${roomId}`);
    } catch (roomError: any) {
      Logging.error(`Failed to add user to entered_id: ${roomError.message}`);
    }

    // Generate QR code and create UserReceipt
    const ticketId = `ticket_${session.id}_${Date.now()}`;
    let entryQRCode = "";

    try {
      entryQRCode = await createEntryQRCode(roomId, userId, ticketId);
      Logging.log(
        `Entry QR code generated for user ${userId} for room ${roomId}`
      );
    } catch (qrError: any) {
      Logging.error(`Entry QR code generation error: ${qrError.message}`);
    }

    // Create UserReceipt document
    try {
      const userReceipt = await UserReceipt.create({
        userId,
        roomId,
        stripePaymentIntentId: pi || "",
        stripeSessionId: session.id,
        tierTitle: target.title,
        tierType: target.tiers,
        quantity,
        unitPrice: target.price,
        totalAmount: revenue,
        entryQRCode,
        ticketId,
        status: PaymentStatus.COMPLETED,
      });

      Logging.log(
        `UserReceipt created for user ${userId}, room ${roomId}, receipt: ${userReceipt._id}`
      );
    } catch (receiptError: any) {
      Logging.error(`Failed to create UserReceipt: ${receiptError.message}`);
    }
  } catch (error: any) {
    Logging.error(`Checkout fulfillment error: ${error.message}`);
  }
}
