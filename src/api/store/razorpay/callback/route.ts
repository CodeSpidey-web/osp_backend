import { createHmac } from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = (req.body || {}) as any

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" })
  }

  const secret = process.env.RAZORPAY_SECRET || ""

  if (!secret) {
    return res.status(500).json({ error: "RAZORPAY_SECRET is not configured" })
  }

  try {
    const generated = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex")

    if (generated !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" })
    }

    return res.json({ ok: true, verified: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
