import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendMail } from "../../../utils/mail";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { email, first_name, password } = req.body as {
    email: string;
    first_name: string;
    password?: string;
  };

  if (!email || !first_name) {
    return res.status(400).json({ message: "Missing required fields (email, first_name)" });
  }

  try {
    const customerName = first_name || "Customer";
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #136c39; font-size: 24px; font-weight: 700; margin: 0 0 10px 0;">Welcome to Ocean Student Projects!</h2>
          <p style="color: #4a5568; font-size: 16px; margin: 0;">Your account has been created successfully.</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;" />
        <p style="color: #2d3748; font-size: 15px; line-height: 1.6;">Dear ${customerName},</p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">Thank you for registering on our platform. Your account is active and you can now log in, purchase project kits, track orders, and request custom project support.</p>
        
        ${password ? `
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 6px; border: 1px solid #edf2f7; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #2d3748; font-size: 15px;"><strong>Your Account Credentials:</strong></p>
          <p style="margin: 0 0 6px 0; color: #4a5568; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0 0 12px 0; color: #4a5568; font-size: 14px;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 15px; background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">${password}</span></p>
          <p style="margin: 0; color: #718096; font-size: 12px; font-style: italic;">💡 Tip: In case you forget your password in the future, you can check this email for your registered credentials.</p>
        </div>
        ` : ""}

        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:3000/login" target="_blank" style="background-color: #136c39; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 15px; display: inline-block;">
            Log In to Storefront
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <div style="text-align: center; font-size: 12px; color: #a0aec0;">
          <p style="margin: 0 0 5px 0;">Ocean Student Projects</p>
          <p style="margin: 0;">No.10 Kareem Mohideen sahib St, Chintadripet, Chennai - 600002, Tamil Nadu, India.</p>
        </div>
      </div>
    `;

    await sendMail({
      to: email,
      subject: "Welcome to Ocean Student Projects!",
      html: emailHtml
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending customer welcome email:", error);
    res.status(500).json({ message: error.message || "Failed to send welcome email" });
  }
}
