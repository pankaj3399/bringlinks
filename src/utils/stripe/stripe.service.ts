import Stripe from "stripe";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";

const stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
if (!stripeApiKey) {
  throw new Error("Missing STRIPE_SECRET_KEY in env");
}

const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2025-09-30.clover",
});

export class StripeService {
 
  static async createConnectAccount(userId: string, email: string, country: string = "US") {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: country,
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        settings: {
          payouts: {
            schedule: {
              interval: "daily",
            },
          },
        },
      });

      Logging.log(`Stripe Connect account created: ${account.id}`);
      return account;
    } catch (error: any) {
      Logging.error(`Stripe Connect account creation error: ${error.message}`);
      throw new Error(`Failed to create Stripe Connect account: ${error.message}`);
    }
  }

   static async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: "account_onboarding",
      });

      Logging.log(`Stripe account link created: ${accountLink.url}`);
      return accountLink;
    } catch (error: any) {
      Logging.error(`Stripe account link creation error: ${error.message}`);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }


  static async getAccount(accountId: string) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      return account;
    } catch (error: any) {
      Logging.error(`Stripe account retrieval error: ${error.message}`);
      throw new Error(`Failed to retrieve account: ${error.message}`);
    }
  }


  static async createLoginLink(accountId: string) {
    try {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return loginLink;
    } catch (error: any) {
      Logging.error(`Stripe login link creation error: ${error.message}`);
      throw new Error(`Failed to create login link: ${error.message}`);
    }
  }

  static async isAccountReady(accountId: string): Promise<boolean> {
    try {
      const account = await this.getAccount(accountId);
      
      return (
        account.details_submitted === true &&
        account.charges_enabled === true &&
        account.payouts_enabled === true &&
        account.capabilities?.card_payments === "active" &&
        account.capabilities?.transfers === "active"
      );
    } catch (error: any) {
      Logging.error(`Stripe account readiness check error: ${error.message}`);
      return false;
    }
  }

  static async createPaymentIntent(
    amount: number,
    currency: string = "usd",
    connectedAccountId: string,
    metadata: Record<string, string> = {}
  ) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), 
        currency: currency,
        application_fee_amount: Math.round(amount * 0.1 * 100), 
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          ...metadata,
          platform: "bringlinks",
        },
      });

      Logging.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: any) {
      Logging.error(`Payment intent creation error: ${error.message}`);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  static async createTransfer(
    amount: number,
    connectedAccountId: string,
    metadata: Record<string, string> = {}
  ) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), 
        currency: "usd",
        destination: connectedAccountId,
        metadata: {
          ...metadata,
          platform: "bringlinks",
        },
      });

      Logging.log(`Transfer created: ${transfer.id}`);
      return transfer;
    } catch (error: any) {
      Logging.error(`Transfer creation error: ${error.message}`);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
  }

  static async getAccountBalance(accountId: string) {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: accountId,
      });

      return balance;
    } catch (error: any) {
      Logging.error(`Account balance retrieval error: ${error.message}`);
      throw new Error(`Failed to retrieve account balance: ${error.message}`);
    }
  }

  static async listTransfers(connectedAccountId: string, limit: number = 10) {
    try {
      const transfers = await stripe.transfers.list({
        destination: connectedAccountId,
        limit: limit,
      });

      return transfers;
    } catch (error: any) {
      Logging.error(`Transfers listing error: ${error.message}`);
      throw new Error(`Failed to list transfers: ${error.message}`);
    }
  }

  static async createCheckoutSession(params: {
    amount: number; 
    currency?: string;
    connectedAccountId: string;
    successUrl: string;
    cancelUrl: string;
    quantity?: number;
    metadata?: Record<string, string>;
    productName?: string;
  }) {
    const {
      amount,
      currency = "usd",
      connectedAccountId,
      successUrl,
      cancelUrl,
      quantity = 1,
      metadata = {},
      productName = "Room Ticket",
    } = params;

    const unitAmount = Math.round(amount * 100);
    const appFee = Math.round(amount * quantity * 0.1 * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: { name: productName },
          },
          quantity,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        platform: "bringlinks",
      },
      payment_intent_data: {
        application_fee_amount: appFee,
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          ...metadata,
          platform: "bringlinks",
        },
      },
    });

    return session;
  }

  static async createPayout(connectedAccountId: string, amountCents: number, currency: string = "usd") {
    const payout = await stripe.payouts.create({ amount: amountCents, currency }, {
      stripeAccount: connectedAccountId,
    });
    return payout;
  }
}

export default StripeService;







