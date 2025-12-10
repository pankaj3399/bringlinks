import Stripe from "stripe";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";

class StripeService {
  private stripeApiKey = validateEnv.STRIPE_SECRET_KEY;
  private stripe: Stripe;

  constructor() {
    if (!this.stripeApiKey) {
      throw new Error("Missing STRIPE_SECRET_KEY in env");
    }
    this.stripe = new Stripe(this.stripeApiKey, {
      apiVersion: "2025-10-29.clover",
    });
  }

  public getPlatformFeeRate(unitAmountUsd: number): number {
    if (unitAmountUsd <= 60) return 0.189;
    if (unitAmountUsd <= 90) return 0.169;
    return 0.149;
  }

  public async createConnectAccount(
    userId: string,
    email: string,
    country: string = "US"
  ) {
    try {
      const account = await this.stripe.accounts.create({
        type: "express",
        country: country,
        email: email,
        metadata: {
          userId: userId,
        },
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
      throw new Error(
        `Failed to create Stripe Connect account: ${error.message}`
      );
    }
  }

  public async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
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

  public async getAccount(accountId: string) {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account;
    } catch (error: any) {
      Logging.error(`Stripe account retrieval error: ${error.message}`);
      throw new Error(`Failed to retrieve account: ${error.message}`);
    }
  }

  public async createLoginLink(accountId: string) {
    try {
      const loginLink = await this.stripe.accounts.createLoginLink(accountId);
      return loginLink;
    } catch (error: any) {
      Logging.error(`Stripe login link creation error: ${error.message}`);
      throw new Error(`Failed to create login link: ${error.message}`);
    }
  }

  public async isAccountReady(accountId: string): Promise<boolean> {
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

  public async createPaymentIntent(
    amount: number,
    currency: string = "usd",
    connectedAccountId: string,
    metadata: Record<string, string> = {},
  ) {
    try {
      const platformFeeRate = this.getPlatformFeeRate(amount);
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency,
        application_fee_amount: Math.round(amount * platformFeeRate * 100),
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          ...metadata,
          platform: "Bringing Link Ups",
        },
      });

      Logging.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: any) {
      Logging.error(`Payment intent creation error: ${error.message}`);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  public async createTransfer(
    amount: number,
    connectedAccountId: string,
    metadata: Record<string, string> = {},
  ) {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        destination: connectedAccountId,
        metadata: {
          ...metadata,
          platform: "Bringing Link Ups",
        },
      });

      Logging.log(`Transfer created: ${transfer.id}`);
      return transfer;
    } catch (error: any) {
      Logging.error(`Transfer creation error: ${error.message}`);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
  }

  public async getAccountBalance(accountId: string) {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId,
      });

      return balance;
    } catch (error: any) {
      Logging.error(`Account balance retrieval error: ${error.message}`);
      throw new Error(`Failed to retrieve account balance: ${error.message}`);
    }
  }

  public async listTransfers(connectedAccountId: string, limit: number = 10) {
    try {
      const transfers = await this.stripe.transfers.list({
        destination: connectedAccountId,
        limit: limit,
      });

      return transfers;
    } catch (error: any) {
      Logging.error(`Transfers listing error: ${error.message}`);
      throw new Error(`Failed to list transfers: ${error.message}`);
    }
  }

  public async createCheckoutSession(params: {
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
    const platformFeeRate = this.getPlatformFeeRate(amount);
    const appFee = Math.round(amount * quantity * platformFeeRate * 100);

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: { name: productName },
            tax_behavior: "exclusive",
          },
          quantity,
        },
      ],
      automatic_tax: {
        enabled: true,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        platform: "Bringing Link Ups",
      },
      payment_intent_data: {
        application_fee_amount: appFee,
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          ...metadata,
          platform: "Bringing Link Ups",
        },
      },
    });

    return session;
  }

  public async createPayout(
    connectedAccountId: string,
    amountCents: number,
    currency: string = "usd"
  ) {
    const payout = await this.stripe.payouts.create(
      { amount: amountCents, currency },
      {
        stripeAccount: connectedAccountId,
      }
    );
    return payout;
  }

  public async calculateTaxEstimate(params: {
    amount: number;
    quantity: number;
    currency?: string;
    country?: string;
    postalCode?: string;
    state?: string;
  }) {
    try {
      const {
        amount,
        quantity,
        currency = "usd",
        country,
        postalCode,
        state,
      } = params;

      const unitAmount = Math.round(amount * 100);
      const totalAmount = unitAmount * quantity;

      const lineItems: Stripe.Tax.CalculationCreateParams.LineItem[] = [
        {
          amount: totalAmount,
          reference: "ticket_purchase",
        },
      ];

      const customerDetails: Stripe.Tax.CalculationCreateParams.CustomerDetails =
        {};

      if (country) {
        customerDetails.address = {
          country: country.toUpperCase(),
        };
        if (postalCode) {
          customerDetails.address.postal_code = postalCode;
        }
        if (state) {
          customerDetails.address.state = state;
        }
      }

      const calculation = await this.stripe.tax.calculations.create({
        currency: currency.toLowerCase(),
        line_items: lineItems,
        ...(Object.keys(customerDetails).length > 0 && {
          customer_details: customerDetails,
        }),
      });

      const subtotal =
        calculation.amount_total - (calculation.tax_amount_exclusive || 0);
      const taxAmount = calculation.tax_amount_exclusive || 0;
      const totalWithTax = calculation.amount_total;

      const taxBreakdown =
        (calculation.tax_breakdown as any)?.map((tax: any) => ({
          amount: tax.amount / 100,
          rate: tax.rate ? tax.rate / 100 : 0,
          jurisdiction: tax.jurisdiction?.country || "Unknown",
          taxabilityReason: tax.taxability_reason || "not_taxable",
        })) || [];

      return {
        subtotal: subtotal / 100,
        taxAmount: taxAmount / 100,
        totalWithTax: totalWithTax / 100,
        taxBreakdown,
        currency: currency.toLowerCase(),
      };
    } catch (error: any) {
      Logging.error(`Tax calculation error: ${error.message}`);
      throw new Error(`Failed to calculate tax estimate: ${error.message}`);
    }
  }
}

export default new StripeService();
