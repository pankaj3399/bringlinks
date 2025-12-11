import { Router, Request, Response } from "express";
import Stripe from "stripe";
import crypto from "crypto";
import { validateEnv } from "../../../../config/validateEnv";
import Creator from "./creator.model";
import Logging from "../../../library/logging";
import { StripeAccountStatus } from "./creator.interface";
import PaidRoom from "../../room/paidRooms/paidRoom.model";
import { createEntryQRCode } from "../../room/room.service";
import Rooms from "../../room/room.model";

const stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2025-09-30.clover" as any,
});

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = validateEnv.STRIPE_WEBHOOK_SECRET;
  
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
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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
    const creator = await Creator.findOne({ stripeConnectAccountId: account.id });
    if (!creator) {
      Logging.log(`No creator found for Stripe account: ${account.id}`);
      return;
    }

    const isReady = (
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.capabilities?.card_payments === "active" &&
      account.capabilities?.transfers === "active"
    );

    const newStatus = isReady ? StripeAccountStatus.ACTIVE : StripeAccountStatus.PENDING;

    if (creator.stripeAccountStatus !== newStatus) {
      await Creator.findByIdAndUpdate(creator._id, {
        stripeAccountStatus: newStatus,
      });

      Logging.log(`Creator ${creator._id} Stripe status updated to: ${newStatus}`);
    }
  } catch (error: any) {
    Logging.error(`Handle account updated error: ${error.message}`);
  }
}

async function handleCapabilityUpdated(capability: Stripe.Capability) {
  try {
    const accountId = capability.account as string;
    const creator = await Creator.findOne({ stripeConnectAccountId: accountId });
    if (!creator) {
      Logging.log(`No creator found for Stripe account: ${accountId}`);
      return;
    }

    const account = await stripe.accounts.retrieve(accountId);
    const isReady = (
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.capabilities?.card_payments === "active" &&
      account.capabilities?.transfers === "active"
    );

    const newStatus = isReady ? StripeAccountStatus.ACTIVE : StripeAccountStatus.PENDING;

    if (creator.stripeAccountStatus !== newStatus) {
      await Creator.findByIdAndUpdate(creator._id, {
        stripeAccountStatus: newStatus,
      });

      Logging.log(`Creator ${creator._id} Stripe status updated to: ${newStatus} after capability update`);
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

    if (!roomId || !userId || !tierTitle) {
      Logging.error(
        `Missing metadata - roomId: ${roomId}, userId: ${userId}, tierTitle: ${tierTitle}`,
      );
      return;
    }

    const paidRoom = await PaidRoom.findOne({ "tickets.roomId": roomId });
    if (!paidRoom) {
      Logging.error(`PaidRoom not found for roomId: ${roomId}`);
      return;
    }

    const pricing = paidRoom.tickets?.pricing || [];
    const pricingIndex = pricing.findIndex(
      (p: any) => p.title === tierTitle || p.tiers === tierTitle,
    );

    if (pricingIndex === -1) {
      Logging.error(
        `Tier "${tierTitle}" not found! Available tiers: ${pricing
          .map((p: any) => p.title)
          .join(", ")}`,
      );
      return;
    }

    const tier = pricing[pricingIndex] as any;
    if (tier.available < quantity) {
      Logging.error(
        `Insufficient tickets! Requested: ${quantity}, Available: ${tier.available}`,
      );
      return;
    }

    // Calculate revenue for this purchase
    const revenue = tier.price * quantity;

    // Get payment intent ID
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    // Use the tier identifier (tiers enum value) for array filter
    const tierIdentifier = tier.tiers || tier.title;

    // Recalculate revenue from updated pricing (after increment)
    const updatedPricing = [...pricing];
    updatedPricing[pricingIndex] = {
      ...tier,
      sold: (tier.sold || 0) + quantity,
      available: Math.max(0, (tier.available || 0) - quantity),
    };

    const newTotalSold = updatedPricing.reduce((acc: number, curr: any) => {
      const sold = Number(curr?.sold ?? 0);
      return acc + (Number.isFinite(sold) ? sold : 0);
    }, 0);

    const newTotalTicketsAvailable = updatedPricing.reduce((acc: number, curr: any) => {
      const available = Number(curr?.available ?? 0);
      return acc + (Number.isFinite(available) ? available : 0);
    }, 0);

    // Calculate total revenue from all pricing tiers
    const newTotalRevenue = updatedPricing.reduce((acc: number, curr: any) => {
      const price = Number(curr?.price ?? 0);
      const sold = Number(curr?.sold ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(sold)) return acc;
      const tierRevenue = price * sold;
      return acc + tierRevenue;
    }, 0);

    // Use MongoDB updateOne with atomic operators for reliable updates
    const updateQuery: any = {
      $inc: {
        "tickets.pricing.$[elem].sold": quantity,
        "tickets.pricing.$[elem].available": -quantity,
        "tickets.totalRevenue": revenue,
      },
      $addToSet: {
        "tickets.paidUsers": userId,
      },
      $set: {
        "tickets.totalSold": newTotalSold,
        "tickets.totalTicketsAvailable": newTotalTicketsAvailable,
      },
    };

    // Add receiptId if payment intent exists
    if (pi) {
      updateQuery.$addToSet["tickets.receiptId"] = pi;
    }

    const arrayFilters = [
      {
        $or: [
          { "elem.tiers": tierIdentifier },
          { "elem.title": tierTitle },
        ],
      },
    ];

    const updateResult = await PaidRoom.updateOne(
      { "tickets.roomId": roomId },
      updateQuery,
      { arrayFilters }
    );

    if (!updateResult || updateResult.matchedCount === 0) {
      Logging.error(`Failed to update PaidRoom for roomId: ${roomId}`);
      return;
    }

    try {
      await Rooms.updateOne(
        { _id: roomId },
        { $addToSet: { entered_id: userId } },
      );
    } catch (roomError: any) {
      Logging.error(`Failed to add user to entered_id: ${roomError.message}`);
    }

    // // Generate QR code and create UserReceipt
    // const ticketId = `ticket_${session.id}_${Date.now()}`;
    // let entryQRCode = "";

    // try {
    //   entryQRCode = await createEntryQRCode(roomId, userId, ticketId);
    //   Logging.log(
    //     `Entry QR code generated for user ${userId} for room ${roomId}`,
    //   );
    // } catch (qrError: any) {
    //   Logging.error(`Entry QR code generation error: ${qrError.message}`);
    // }

    // // Extract tax information from session
    // const subtotal = fullSession.amount_subtotal
    //   ? fullSession.amount_subtotal / 100
    //   : revenue;
    // const taxAmount = fullSession.total_details?.amount_tax
    //   ? fullSession.total_details.amount_tax / 100
    //   : 0;
    // const totalWithTax = fullSession.amount_total
    //   ? fullSession.amount_total / 100
    //   : revenue + taxAmount;

    // // Parse tax breakdown if available
    // let taxBreakdown: Array<{
    //   rate: number;
    //   amount: number;
    //   jurisdiction: string;
    //   taxabilityReason?: string;
    // }> = [];

    // const breakdown = fullSession.total_details?.breakdown;
    // if (breakdown && "tax" in breakdown && Array.isArray(breakdown.tax)) {
    //   taxBreakdown = breakdown.tax.map((tax: any) => ({
    //     rate: tax.rate ? tax.rate / 100 : 0,
    //     amount: tax.amount / 100,
    //     jurisdiction: tax.jurisdiction?.country || "Unknown",
    //     taxabilityReason: tax.taxability_reason || undefined,
    //   }));
    // }

    // Create UserReceipt document
    // TODO: Uncomment when UserReceipt model and PaymentStatus enum are available
    // try {
    //   const userReceipt = await UserReceipt.create({
    //     userId,
    //     roomId,
    //     stripePaymentIntentId: pi || "",
    //     stripeSessionId: fullSession.id,
    //     tierTitle: target.title,
    //     tierType: target.tiers,
    //     quantity,
    //     unitPrice: target.price,
    //     totalAmount: revenue,
    //     subtotal,
    //     taxAmount,
    //     totalWithTax,
    //     taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
    //     entryQRCode,
    //     ticketId,
    //     status: PaymentStatus.COMPLETED,
    //   });

    //   Logging.log(
    //     `UserReceipt created for user ${userId}, room ${roomId}, receipt: ${userReceipt._id}`,
    //   );
    // } catch (receiptError: any) {
    //   Logging.error(`Failed to create UserReceipt: ${receiptError.message}`);
    // }
  } catch (error: any) {
    Logging.error(`Checkout fulfillment error: ${error.message}`);
    throw error;
  }
}







