import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendMail } from "../../../utils/mail";
import {
  BRAND,
  renderBrandedEmail,
  renderButton,
  escapeHtml,
  getStorefrontUrl,
} from "../../../utils/emailLayout";

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
    const customerName = escapeHtml(first_name || "Customer");
    const storefrontUrl = getStorefrontUrl();
    const loginHref = `${storefrontUrl}/login`;
    const safeEmail = escapeHtml(email);

    const credentialsBlock = password
      ? `
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid ${BRAND.colors.borderSoft}; margin: 20px 0;">
          <p style="margin: 0 0 12px 0; color: ${BRAND.colors.textPrimary}; font-size: 15px; font-weight: 700;">Your Account Credentials</p>
          <p style="margin: 0 0 6px 0; color: ${BRAND.colors.textBody}; font-size: 14px;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 10px 0; color: ${BRAND.colors.textBody}; font-size: 14px;">
            <strong>Password:</strong>
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 14px; background: #e2e8f0; padding: 3px 8px; border-radius: 4px; margin-left: 4px;">${escapeHtml(password)}</span>
          </p>
          <p style="margin: 0; color: ${BRAND.colors.textMuted}; font-size: 12px; font-style: italic;">
            💡 Tip: If you ever forget your password, you can reset it from the login screen.
          </p>
        </div>
      `
      : "";

    const body = `
      <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Dear ${customerName},
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Thank you for registering on the <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong> platform. Your account is active and ready to go.
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
        You can now:
      </p>
      <ul style="margin: 0 0 10px 0; padding-left: 20px; color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.75;">
        <li>Log in and browse our full catalog of electronics components &amp; development boards</li>
        <li>Purchase project kits with fast, tracked delivery across India</li>
        <li>Track all your orders from a single dashboard</li>
        <li>Request custom project support &amp; engineering guidance</li>
      </ul>

      ${credentialsBlock}

      <div style="text-align: center;">
        ${renderButton({ label: "Log In to Storefront", href: loginHref, variant: "primary" })}
      </div>

      <p style="color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65; margin: 24px 0 0 0;">
        If you have any questions, reply to this email or call us at
        <a href="tel:${escapeHtml(BRAND.contact.phoneHref)}" style="color: ${BRAND.colors.green}; font-weight: 600; text-decoration: none;"> ${escapeHtml(BRAND.contact.phone)}</a>.
      </p>

      <p style="color: ${BRAND.colors.textMuted}; font-size: 13px; line-height: 1.6; text-align: center; margin: 28px 0 0 0;">
        Happy building! 💚<br/>
        <strong style="color: ${BRAND.colors.green};">The ${escapeHtml(BRAND.shortName)} Team</strong>
      </p>
    `;

    const emailHtml = renderBrandedEmail({
      previewText: `Welcome to ${BRAND.name}, ${first_name}! Your account is ready.`,
      heroEmoji: "🎉",
      heroHeading: "Welcome to Ocean Student Projects!",
      heroSubheading: "Your account has been created successfully.",
      body,
    });

    await sendMail({
      to: email,
      subject: `Welcome to ${BRAND.name}!`,
      html: emailHtml,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending customer welcome email:", error);
    res.status(500).json({ message: error.message || "Failed to send welcome email" });
  }
}
