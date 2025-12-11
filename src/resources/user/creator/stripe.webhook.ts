import { Router, Request, Response } from "express";
import Stripe from "stripe";
import crypto from "crypto";
import { validateEnv } from "../../../../config/validateEnv";
import Creator from "./creator.model";
import Logging from "../../../library/logging";
import { StripeAccountStatus } from "./creator.interface";
import PaidRoom from "../../room/paidRooms/paidRoom.model";
import Rooms from "../../room/room.model";
import { createEntryQRCode } from "../../room/room.service";
import Receipts from "../../room/receipts/receipts.model";
import { PaymentStatus } from "../../room/receipts/receipts.interface";
import mongoose from "mongoose";

const stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2025-10-29.clover",
});

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = validateEnv.STRIPE_WEBHOOK_SECRET;

  Logging.log(`STRIPE_WEBHOOK_SECRET: ${endpointSecret}`);
  if (!endpointSecret) {
    Logging.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }
  
  if (!sig) {
    Logging.error("Stripe signature header is missing");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  const rawBody = (req as any).rawBody || req.body;

  let event: Stripe.Event;

  try {
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ 
        error: "Invalid request body format. Raw body required for signature verification." 
      });
    }
    
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
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
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["total_details.breakdown.taxes"],
    });

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 1,
      expand: ["data.price.product"],
    });

    const metadata = (fullSession.metadata || {}) as Record<string, string>;
    const roomId = metadata.roomId;
    const userId = metadata.userId;
    const tierTitle = metadata.tierTitle;
    const tierType = metadata.tierType;
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

    const pricing = paidRoom.tickets?.pricing || [] as any[];
    const idx = pricing.findIndex((p: any) => p.title === tierTitle || p.tiers === tierTitle);
    const target = idx >= 0 ? pricing[idx] : pricing[0];
    if (target) {
      target.sold += quantity;
      target.available = Math.max(0, target.available - quantity);
    }
    paidRoom.tickets.totalSold += quantity;
    paidRoom.tickets.totalTicketsAvailable = Math.max(0, paidRoom.tickets.totalTicketsAvailable - quantity);
    if (!paidRoom.tickets.receiptId) paidRoom.tickets.receiptId = [] as any;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (pi) (paidRoom.tickets.receiptId as any).push(pi);
    if (!paidRoom.tickets.paidUsers) paidRoom.tickets.paidUsers = [] as any;
    (paidRoom.tickets.paidUsers as any).push(userId);

    await paidRoom.save();

    // Generate ticket ID and QR code
    let ticketId = `ticket_${session.id}_${Date.now()}`;
    let entryQRCode = "";

    try {
      entryQRCode = await createEntryQRCode(roomId, userId, ticketId);
      Logging.log(`Entry QR code generated for user ${userId} for room ${roomId}`);
    } catch (qrError: any) {
      Logging.error(`Entry QR code generation error: ${qrError.message}`);
    }

    // Create receipt after checkout completed (separate try-catch for better error handling)
    try {
      const paymentIntentId = typeof fullSession.payment_intent === "string" 
        ? fullSession.payment_intent 
        : fullSession.payment_intent?.id || "";
      
      if (!paymentIntentId) {
        Logging.error(`Payment intent ID not found for session ${session.id}`);
        return;
      }

      const receiptData = {
        userId: new mongoose.Types.ObjectId(userId),
        paidRoomId: paidRoom._id,
        roomId: new mongoose.Types.ObjectId(roomId),
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: session.id,
        tierTitle: tierTitle || target?.title || "",
        tierType: target?.tiers || "",
        quantity: quantity,
        unitPrice: target?.price || 0,
        totalAmount: (fullSession.amount_total || 0) / 100,
        entryQRCode: entryQRCode,
        ticketId: ticketId,
        status: PaymentStatus.COMPLETED,
      };

      Logging.log(`Creating receipt with data: ${JSON.stringify({
        userId: receiptData.userId.toString(),
        paidRoomId: receiptData.paidRoomId.toString(),
        roomId: receiptData.roomId.toString(),
        stripePaymentIntentId: receiptData.stripePaymentIntentId,
        stripeSessionId: receiptData.stripeSessionId,
        tierTitle: receiptData.tierTitle,
        tierType: receiptData.tierType,
        quantity: receiptData.quantity,
        unitPrice: receiptData.unitPrice,
        totalAmount: receiptData.totalAmount,
        status: receiptData.status,
      })}`);

      const createdReceipt = await Receipts.create(receiptData);
      Logging.log(`Receipt created successfully in 'receipts' collection. Receipt ID: ${createdReceipt._id}, User: ${userId}, Room: ${roomId}`);
      
    } catch (receiptError: any) {
      Logging.error(`Receipt creation error: ${receiptError.message}`);
      Logging.error(`Receipt creation error stack: ${receiptError.stack}`);
      if (receiptError.errors) {
        Logging.error(`Receipt validation errors: ${JSON.stringify(receiptError.errors)}`);
      }
    }
  } catch (error: any) {
    Logging.error(`Checkout fulfillment error: ${error.message}`);
    throw error;
  }
}
