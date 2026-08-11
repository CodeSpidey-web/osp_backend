import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import * as fs from 'fs'
import * as path from 'path'
import { sendMail } from "../utils/mail"
import {
  BRAND,
  renderBrandedEmail,
  renderButton,
  escapeHtml,
  getStorefrontUrl,
} from "../utils/emailLayout"

export default async function passwordResetHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const { data } = event

  console.log("================ PASSWORD RESET EVENT INTERCEPTED ================")
  console.log("Data:", JSON.stringify(data, null, 2))
  console.log("================================================================")

  const email = data.email || data.entity_id || data.identifier || data.user_email || "";
  const token = data.token || "";

  try {
    const logFilePath = 'C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\aa0764c5-558a-42a7-9ce7-f0235580d60a\\password_resets.log'
    const logMessage = `[${new Date().toISOString()}] Email: ${email}, Token: ${token}\n`
    fs.appendFileSync(logFilePath, logMessage)
  } catch (logErr) {
    console.warn("[Password Reset] Could not write to log file:", logErr)
  }

  if (!email || !token) {
    console.warn("[Password Reset] Missing email or token, skipping password reset email.")
    return
  }

  try {
    const storefrontUrl = getStorefrontUrl()
    const resetLink = `${storefrontUrl}/login?token=${encodeURIComponent(token)}`
    const safeEmail = escapeHtml(email)
    const safeResetLink = escapeHtml(resetLink)

    const body = `
      <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Hello,
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
        We received a request to reset the password for your
        <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong> account
        (<strong>${safeEmail}</strong>).
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 8px 0;">
        Click the button below to set a new password. This link is valid for a limited time:
      </p>

      <div style="text-align: center;">
        ${renderButton({ label: "Reset Your Password", href: resetLink, variant: "primary" })}
      </div>

      <div style="background-color: #f8fafc; padding: 16px 18px; border-radius: 10px; border: 1px solid ${BRAND.colors.borderSoft}; margin: 8px 0 0 0;">
        <p style="margin: 0 0 6px 0; color: ${BRAND.colors.textMuted}; font-size: 12px; line-height: 1.5;">
          If the button above does not work, copy and paste the link below into your browser:
        </p>
        <p style="margin: 0; word-break: break-all; color: ${BRAND.colors.green}; font-size: 12px; line-height: 1.55; font-family: 'Courier New', Courier, monospace;">
          ${safeResetLink}
        </p>
      </div>

      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid ${BRAND.colors.orange}; padding: 14px 16px; border-radius: 8px; margin: 22px 0 0 0;">
        <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
          💡 <strong style="color: #9a3412;">Security Notice:</strong><br/>
          If you did <em>not</em> request a password reset, you can safely ignore this email — your password will remain unchanged.
        </p>
      </div>

      <p style="margin: 24px 0 0 0; color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65;">
        Warm regards,<br/>
        <strong style="color: ${BRAND.colors.green};">The ${escapeHtml(BRAND.shortName)} Team</strong>
      </p>
    `

    const emailHtml = renderBrandedEmail({
      previewText: `Reset your ${BRAND.name} password`,
      heroEmoji: "🔐",
      heroHeading: "Reset Your Password",
      heroSubheading: "Securely set a new password for your account.",
      body,
    })

    await sendMail({
      to: email,
      subject: `Reset Your Password - ${BRAND.name}`,
      html: emailHtml
    })

    console.log(`[Password Reset] Reset email sent to ${email} with link: ${resetLink}`)
  } catch (error) {
    console.error("[Password Reset] Failed to send password reset email:", error)
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
