import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import * as fs from 'fs'
import * as path from 'path'
import { sendMail } from "../utils/mail"

export default async function passwordResetHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const { data } = event

  // Log to console
  console.log("================ PASSWORD RESET EVENT INTERCEPTED ================")
  console.log("Data:", JSON.stringify(data, null, 2))
  console.log("================================================================")

  const email = data.email || data.entity_id || data.identifier || data.user_email || "";
  const token = data.token || "";

  // Write to the artifacts directory to avoid triggering the backend dev watch reload
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

  // Send the password reset email to the customer with the link
  try {
    const storefrontUrl = (process.env.STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "")
    const resetLink = `${storefrontUrl}/login?token=${encodeURIComponent(token)}`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0b2545; margin-top: 0;">Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your <strong>Ocean Student Projects</strong> account (<strong>${email}</strong>).</p>
        <p>Click the button below to set a new password. This link is valid for a limited time:</p>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetLink}" style="background-color: #136c39; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #136c39; font-size: 12px;">${resetLink}</p>

        <p style="color: #6b7280; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
        <br/>
        <p style="margin-bottom: 0;">Warm regards,<br/>Ocean Student Projects Team</p>
      </div>
    `

    await sendMail({
      to: email,
      subject: "Reset Your Password - Ocean Student Projects",
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