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
import UserReceipt from "../../receipt/receipt.model";
import { PaymentStatus } from "../../receipt/receipt.interface";

const stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2025-10-29.clover" as any,
});

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = validateEnv.STRIPE_WEBHOOK_SECRET;
  Logging.log(`endpointSecret: ${endpointSecret}`);

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
          event.data.object as Stripe.Checkout.Session,
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
        `Creator ${creator._id} Stripe status updated to: ${newStatus}`,
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
        `Creator ${creator._id} Stripe status updated to: ${newStatus} after capability update`,
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

    if (!roomId || !userId || !tierTitle) {
      Logging.error(
        `Missing metadata - roomId: ${roomId}, userId: ${userId}, tierTitle: ${tierTitle}`,
      );
      return;
    }

    const existingReceipt = await UserReceipt.findOne({
      stripeSessionId: fullSession.id,
    });
    if (existingReceipt) {
      Logging.log(
        `Receipt already exists for session ${fullSession.id}, skipping fulfillment.`,
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

    const paymentIntentId =
      typeof fullSession.payment_intent === "string"
        ? fullSession.payment_intent
        : fullSession.payment_intent?.id;

    const amountSubtotal = fullSession.amount_subtotal ?? 0;
    const amountTax = fullSession.total_details?.amount_tax ?? 0;
    const amountTotal = fullSession.amount_total ?? amountSubtotal + amountTax;

    const taxBreakdown =
      fullSession.total_details?.breakdown?.taxes?.map((tax) => {
        const ratePercentage =
          typeof tax.rate === "object" && tax.rate !== null
            ? ((tax.rate as any).percentage as number | undefined) ?? 0
            : 0;

        return {
          rate: ratePercentage / 100,
          amount: (tax.amount ?? 0) / 100,
          jurisdiction: (tax as any).jurisdiction || "Unknown",
          taxabilityReason: (tax as any).taxability_reason || undefined,
        };
      }) || [];

    const lineItem = lineItems.data[0];
    const unitPrice =
      (lineItem?.price?.unit_amount ?? tier.price * 100) / 100;

    const subtotal = amountSubtotal / 100;
    const taxAmount = amountTax / 100;
    const totalWithTax = amountTotal / 100;
    const totalAmount = subtotal;

    const ticketId = `ticket_${session.id}_${Date.now()}_${crypto
      .randomBytes(6)
      .toString("hex")}`;
    const entryCode = crypto.randomUUID();

    let entryQRCode: string = entryCode;
    try {
      entryQRCode = await createEntryQRCode(roomId, userId, ticketId);
    } catch (qrError: any) {
      Logging.error(`Entry QR code generation error: ${qrError.message}`);
    }

    tier.sold = (tier.sold || 0) + quantity;
    tier.available = Math.max(0, (tier.available || 0) - quantity);

    paidRoom.tickets.totalSold = pricing.reduce(
      (acc: number, current: any) => acc + (current.sold || 0),
      0,
    );
    paidRoom.tickets.totalTicketsAvailable = pricing.reduce(
      (acc: number, current: any) => acc + (current.available || 0),
      0,
    );
    paidRoom.tickets.totalRevenue = pricing.reduce(
      (acc: number, current: any) => acc + (current.sold || 0) * (current.price || 0),
      0,
    );

    paidRoom.tickets.paidUsers = paidRoom.tickets.paidUsers || [];
    if (!paidRoom.tickets.paidUsers.some((id) => id.toString() === userId)) {
      paidRoom.tickets.paidUsers.push(userId as any);
    }

    paidRoom.tickets.receiptId = paidRoom.tickets.receiptId || [];

    paidRoom.markModified("tickets");

    const userReceipt = await UserReceipt.create({
      userId,
      roomId,
      stripePaymentIntentId: paymentIntentId || "",
      stripeSessionId: fullSession.id,
      tierTitle: tier.title,
      tierType: tierType || tier.tiers,
      quantity,
      unitPrice,
      totalAmount,
      subtotal,
      taxAmount,
      totalWithTax,
      taxBreakdown: taxBreakdown.length ? taxBreakdown : undefined,
      entryQRCode,
      ticketId,
      status: PaymentStatus.COMPLETED,
    });

    if (
      !paidRoom.tickets.receiptId.some(
        (rid: string) => rid.toString() === userReceipt._id.toString(),
      )
    ) {
      paidRoom.tickets.receiptId.push(userReceipt._id.toString());
    }

    const updatedPaidRoom = await paidRoom.save();

    try {
      await Rooms.updateOne(
        { _id: roomId },
        { $addToSet: { entered_id: userId } },
      );
    } catch (roomError: any) {
      Logging.error(`Failed to add user to entered_id: ${roomError.message}`);
    }

    console.log("Stripe checkout totals", {
      subtotal,
      taxAmount,
      totalWithTax,
    });
    console.log("Updated pricing", pricing);
    console.log("Updated paidRoom summary", {
      totalSold: updatedPaidRoom.tickets.totalSold,
      totalTicketsAvailable: updatedPaidRoom.tickets.totalTicketsAvailable,
      totalRevenue: updatedPaidRoom.tickets.totalRevenue,
      paidUsers: updatedPaidRoom.tickets.paidUsers,
      receiptId: updatedPaidRoom.tickets.receiptId,
    });

    return { paidRoom: updatedPaidRoom, receipt: userReceipt };
  } catch (error: any) {
    Logging.error(`Checkout fulfillment error: ${error.message}`);
    throw error;
  }
}
