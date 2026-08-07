import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "Ocean Student Projects <noreply@oceanstudentprojects.com>";

  console.log(`[Email Dispatcher] Preparing email:
  To: ${options.to}
  Subject: ${options.subject}`);

  // If no username or password is provided, or if the password is placeholder
  if (!user || !pass || pass === "your-gmail-app-password") {
    console.warn("[Email Dispatcher] SMTP credentials are not configured in .env. Logging email content to console:");
    console.log("------------------ EMAIL CONTENT START ------------------");
    console.log(`From: ${from}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`HTML Body:\n${options.html}`);
    console.log("------------------ EMAIL CONTENT END --------------------");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html,
    });

    console.log(`[Email Dispatcher] Email sent successfully. MessageID: ${info.messageId}`);
  } catch (error) {
    console.error("[Email Dispatcher] Failed to send email via SMTP:", error);
    // Log to console as fallback in case of delivery error
    console.log("------------------ FALLBACK EMAIL CONTENT ------------------");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`HTML Body:\n${options.html}`);
    console.log("-----------------------------------------------------------");
  }
}
