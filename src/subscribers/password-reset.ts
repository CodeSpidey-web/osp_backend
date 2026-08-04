import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import * as fs from 'fs'
import * as path from 'path'

export default async function passwordResetHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const { data } = event
  
  // Log to console
  console.log("================ PASSWORD RESET EVENT INTERCEPTED ================")
  console.log("Data:", JSON.stringify(data, null, 2))
  console.log("================================================================")

  // Write to the artifacts directory to avoid triggering the backend dev watch reload
  const logFilePath = 'C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\aa0764c5-558a-42a7-9ce7-f0235580d60a\\password_resets.log'
  const email = data.email || data.entity_id || data.identifier || data.user_email || "";
  const token = data.token || "";
  const logMessage = `[${new Date().toISOString()}] Email: ${email}, Token: ${token}\n`
  fs.appendFileSync(logFilePath, logMessage)
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
