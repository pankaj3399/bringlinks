import axios from "axios";
import { validateEnv } from "../../../config/validateEnv";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

class HelcimService {
  public apiKey: string = "";
  public baseUrl: string = "";
  public lambdaClient: LambdaClient;

  constructor() {
    this.baseUrl = validateEnv.HELCIM_BASE_URL;
    this.apiKey = validateEnv.HELCIM_API_KEY;
    this.lambdaClient = new LambdaClient({ region: "us-east-2" });
  }

  public vaultCard = async (cardInfo: {
    cardholderName: string;
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  }) => {
    const url = `${this.baseUrl}/vault/card`;
    const response = await axios.post(url, cardInfo, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.data;
  };

  public vaultBank = async (bankInfo: {
    bankName: string;
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
  }) => {
    const url = `${this.baseUrl}/vault/bank`;
    const response = await axios.post(url, bankInfo, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.data;
  };

  purchaseTickets = async (payload: {
    cardToken: string;
    amount: number;
    description: string;
    customerId: string;
    quantity: number;
  }) => {
    try {
      const command = new InvokeCommand({
        FunctionName: "purchaseTicketHelcim",
        Payload: JSON.stringify(payload),
        InvocationType: "RequestResponse",
      });

      const response = await this.lambdaClient.send(command);
      const data = response.Payload;

      if (data) {
        const decoded = JSON.parse(Buffer.from(data).toString());
        return decoded;
      }

      return { success: true };
    } catch (err) {
      console.error("Lambda call failed:", err);
      throw err;
    }
  };
}

export default new HelcimService();
