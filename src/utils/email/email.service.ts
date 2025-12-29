import sgMail from "@sendgrid/mail";
import { validateEnv } from "../../../config/validateEnv";
import Logging from "../../library/logging";

type AdminSignupCodeRequestPayload = {
  name?: string;
  email: string;
  message?: string;
};

class EmailService {
  private apiKey: string;
  private sgMail;

  constructor() {
    this.apiKey = (validateEnv as any).SENDGRID_API_KEY as string;
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("SendGrid is not configured. Missing SENDGRID_API_KEY");
    }
    try {
      this.sgMail = sgMail;
      this.sgMail.setApiKey(this.apiKey);
    } catch (error: any) {
      throw new Error("Failed to configure SendGrid: " + error.message);
    }
  }

  public async sendAdminSignupCodeRequest(
    payload: AdminSignupCodeRequestPayload
  ) {
    const adminEmail = (validateEnv as any).ADMIN_NOTIFICATION_EMAIL as
      | string
      | undefined;
    const fromEmail =
      ((validateEnv as any).EMAIL_FROM as string | undefined) ||
      (adminEmail as string);

    if (!adminEmail || adminEmail.trim().length === 0) {
      throw new Error("Missing ADMIN_NOTIFICATION_EMAIL in environment");
    }

    const subject = "New Signup Code Request";
    const lines: string[] = [];
    lines.push("A user has requested a signup code.");
    lines.push("");
    lines.push(`Email: ${payload.email}`);
    if (payload.name) lines.push(`Name: ${payload.name}`);
    if (payload.message) {
      lines.push("");
      lines.push("Message:");
      lines.push(payload.message);
    }

    const msg = {
      to: adminEmail,
      from: fromEmail,
      subject,
      text: lines.join("\n"),
    } as any;

    try {
      await this.sgMail.send(msg);
      Logging.log("Admin signup code request email sent");
    } catch (error: any) {
      const response = error?.response;
      const body = response?.body;
      Logging.error({
        hint: "SendGrid send failed",
        status: response?.statusCode,
        body,
      });
      throw new Error(
        body?.errors?.[0]?.message || error.message || "Failed to send email"
      );
    }
  }
  public async sendPasswordRequestEmail(email: string, refreshToken: string) {
    let link: string;
    Logging.log(email);
    Logging.log(refreshToken);

    const adminEmail = (validateEnv as any).ADMIN_NOTIFICATION_EMAIL as
      | string
      | undefined;
    const fromEmail =
      ((validateEnv as any).EMAIL_FROM as string | undefined) ||
      (adminEmail as string);

    if (!email || email.trim().length === 0 || !refreshToken) {
      throw new Error("Missing Email or Refresh Token");
    }
    if (
      validateEnv.NODE_ENV === "development" ||
      validateEnv.NODE_ENV === "staging"
    ) {
      link = "blu://reset-password?token=" + refreshToken;
    } else {
      link = "blu://reset-password?token=" + refreshToken;
    }

    const subject = "Password Request";
    const lines: string[] = [];
    lines.push("A user has requested a password reset.");
    lines.push("");
    lines.push(`Email: ${email}`);
    lines.push("");
    lines.push("Message:");
    lines.push("");
    lines.push("Please reset your password by clicking the link below.");
    lines.push("");
    lines.push(`Reset Link: ${link}`);

    const msg = {
      to: email,
      from: fromEmail,
      subject,
      text: lines.join("\n"),
    } as any;

    try {
      await this.sgMail.send(msg);
      Logging.log("Password request email sent");
    } catch (error: any) {
      const response = error?.response;
      const body = response?.body;
      Logging.error({
        hint: "SendGrid send failed",
        status: response?.statusCode,
        body,
      });
      throw new Error(
        body?.errors?.[0]?.message || error.message || "Failed to send email"
      );
    }
  }

  public async replyToSignupCodeRequestEmail({
    name,
    email,
    status,
    message,
    code,
  }: {
    name: string;
    email: string;
    status: string;
    message: string;
    code: string;
  }) {
    const adminEmail = (validateEnv as any).ADMIN_NOTIFICATION_EMAIL as
      | string
      | undefined;

    if (!adminEmail || adminEmail.trim().length === 0) {
      throw new Error("Missing ADMIN_NOTIFICATION_EMAIL in environment");
    }
    const subject = "BLU Signup Code Request Reply";
    const lines: string[] = [];

    if (status === "approved") {
      lines.push(
        `Hello ${name}, We have received your request for a signup code.`
      );
      lines.push("");
      lines.push(`We have ${status} the Email: ${email} for Entry`);
      lines.push("");
      lines.push(`Please use the following code to signup: ${code}`);
      lines.push("");
      lines.push("Reason:");
      lines.push(message);
    } else if (status === "rejected") {
      lines.push(
        `Hello ${name}, We have received your request for a signup code.`
      );
      lines.push("");
      lines.push(
        `We apologies for the inconvenience. We have ${status} the Email: ${email} for Entry`
      );
      lines.push("");
      lines.push("Reason:");
      lines.push(message);
    }

    const msg = {
      to: email,
      from: adminEmail,
      subject,
      text: lines.join("\n"),
    } as any;
    try {
      await this.sgMail.send(msg);
      Logging.log("Signup code request reply email sent");
    } catch (error: any) {
      const response = error?.response;
      const body = response?.body;
      Logging.error({
        hint: "SendGrid send failed",
        status: response?.statusCode,
        body,
      });
      throw new Error(
        body?.errors?.[0]?.message || error.message || "Failed to send email"
      );
    }
  }

  public async sendReceiptEmail(email: {
    receiverEmail: string;
    roomName: string;
    roomType: string;
    roomLocation: string;
    roomDate: string;
    roomTime: string;
    roomPrice: number;
    roomQuantity: number;
    paymentIntentId: string;
    totalAmount: number;
    entryQRCode: string;
  }) {
    const {
      paymentIntentId,
      receiverEmail,
      roomName,
      roomType,
      roomLocation,
      roomDate,
      roomTime,
      roomPrice,
      roomQuantity,
      totalAmount,
      entryQRCode,
    } = email;

    const emailFrom = (validateEnv as any).EMAIL_FROM as string;
    const subject = "Receipt";

    const lines: string[] = [];
    lines.push(`Hello ${receiverEmail},`);
    lines.push("");
    lines.push(`Thank you for your purchase. Your receipt is attached below.`);
    lines.push("");
    lines.push(`Your Receipt: ${paymentIntentId}`);
    lines.push("");
    lines.push(`Room: ${roomName}`);
    lines.push(`Room Type: ${roomType}`);
    lines.push("");
    lines.push(`Room Location: ${roomLocation}`);
    lines.push(`Room Date: ${roomDate}`);
    lines.push(`Room Time: ${roomTime}`);
    lines.push("");
    lines.push(`Room Price: ${roomPrice}`);
    lines.push(`Room Quantity: ${roomQuantity}`);
    lines.push("");
    lines.push(`Total Amount: ${totalAmount}`);

    const msg: any = {
      to: receiverEmail,
      from: emailFrom,
      subject,
      text: lines.join("\n"),
    };

    // Extract base64 data from entryQRCode and attach as PNG file
    try {
      if (entryQRCode && entryQRCode.startsWith("data:image/png;base64,")) {
        const base64Data = entryQRCode.replace("data:image/png;base64,", "");
        msg.attachments = [
          {
            content: base64Data,
            filename: "entry-qr-code.png",
            type: "image/png",
            disposition: "attachment",
          },
        ];
      }
    } catch (error: any) {
      Logging.error({
        hint: "Failed to parse QR code for attachment",
        error: error.message,
      });
      // Continue without attachment if parsing fails
    }

    try {
      await this.sgMail.send(msg);
      Logging.log("Receipt email sent");
    } catch (error: any) {
      const response = error?.response;
      const body = response?.body;
      Logging.error({
        hint: "SendGrid send failed",
        status: response?.statusCode,
        body,
      });
      throw new Error(
        body?.errors?.[0]?.message || error.message || "Failed to send email"
      );
    }
  }
}

export default new EmailService();