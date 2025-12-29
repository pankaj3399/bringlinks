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
    var html = "";
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
      html = `
        <h2><strong>Hello ${name},</strong></h2>

        <p>
          We have received your request for a signup code.
        </p>

        <p>
          We have <strong>${status}</strong> the email:
          <strong>${email}</strong> for entry.
        </p>

        <p>
          Please use the following code to sign up:
        </p>

        <p style="font-size:18px; font-weight:bold; letter-spacing:1px;">
          ${code}
        </p>

        <p><strong>Reason:</strong></p>

        <p>${message}</p>
`;
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

      html = `
      <h2><strong>Hello ${name},</strong></h2>

      <p>
      We have received your request for a signup code.
      </p>

      <p>
      We apologize for the inconvenience. We have
      <strong>${status}</strong> the email:
      <strong>${email}</strong> for entry.
      </p>

      <p><strong>Reason:</strong></p>

      <p>${message}</p>
      `;
    }

    const msg = {
      to: email,
      from: adminEmail,
      subject,
      text: lines.join("\n"),
      html,
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
    const subject = `**${roomName} - Receipt**`;
    const appleMapsLink = `https://maps.apple.com/?q=${encodeURIComponent(
      roomLocation
    )}`;

    const html = `
      <h2><em>Hello ${receiverEmail},</em></h2>

      <p>Thank you for your purchase. Your receipt is attached below.</p>

      <p>
        <strong>Your Entry QR Code:</strong> <img src="data:image/png;base64,${entryQRCode}" alt="Entry QR Code" /><br/>
        <strong>Your Receipt:</strong> ${paymentIntentId}
      </p>

      <p>
        <strong>Room Name:</strong> ${roomName}<br/>
        <strong>Room Type:</strong> ${roomType}
      </p>

      <p>
        <strong>Room Date:</strong> ${roomDate}<br/>
        <strong>Room Time:</strong> ${roomTime}<br/>
        <strong>Room Location:</strong>
        <a href="${appleMapsLink}" target="_blank">Open in Apple Maps</a>
      </p>

      <p>
        <strong>Room Price:</strong> ${roomPrice}<br/>
        <strong>Room Quantity:</strong> ${roomQuantity}
      </p>

      <p><strong>Total Amount:</strong> ${totalAmount}</p>

      <p>Thank you for your purchase.</p>
`;

    const lines: string[] = [];
    lines.push("");
    // make hello italic markdown
    lines.push(`**Hello ${receiverEmail},**`);
    lines.push("");
    lines.push(`Thank you for your purchase. Your receipt is attached below.`);
    lines.push("");
    lines.push(
      `Your Entry QR Code: <img src="data:image/png;base64,${entryQRCode}" alt="Entry QR Code" />`
    );
    lines.push(`Your Receipt: ${paymentIntentId}`);
    lines.push("");
    // make room name bold markdown
    lines.push(`**Room Name:** ${roomName}`);
    lines.push(`**Room Type:** ${roomType}`);
    lines.push("");
    // make room location clickable with apple maps link
    lines.push(`Room Date: ${roomDate}`);
    lines.push(`Room Time: ${roomTime}`);
    lines.push(`Room Location: ${appleMapsLink}`);
    lines.push("");
    lines.push(`Room Price: ${roomPrice}`);
    lines.push(`Room Quantity: ${roomQuantity}`);
    lines.push("");
    lines.push(`Total Amount: ${totalAmount}`);

    const msg = {
      to: receiverEmail,
      from: emailFrom,
      subject,
      text: lines.join("\n"),
      html,
    } as any;

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
