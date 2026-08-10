import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"

// Safety-net subscriber: triggers on fulfillment.created event
// Catches orders when fulfillment is created but shipment.created event might not fire
// Uses idempotency check via in-memory set to avoid sending duplicate emails

const recentlySentOrderIds = new Set<string>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000 // 5 minutes window

export default async function orderFulfillmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const query = container.resolve("query")

  try {
    console.log(`[Fulfillment Created Subscriber] 🚀 Received event: ${event.name}`)

    // ---------------------------------------------------
    // STEP 1: Resolve order_id robustly
    // ---------------------------------------------------
    let orderId: string | null = null
    let fulfillmentId: string | null = null

    // Try all common payload shapes
    const payload = event.data || {}

    if (payload.order_id) {
      orderId = payload.order_id
    }

    if (payload.id) {
      fulfillmentId = payload.id
    }

    if (!orderId && payload.data?.order_id) {
      orderId = payload.data.order_id
    }

    if (!fulfillmentId && payload.data?.id) {
      fulfillmentId = payload.data.id
    }

    // If no order_id, try order_fulfillment join table
    if (!orderId && fulfillmentId) {
      try {
        const { data: [ofJoin] } = await query.graph({
          entity: "order_fulfillment",
          fields: ["order_id"],
          filters: { fulfillment_id: fulfillmentId },
        })
        if (ofJoin?.order_id) {
          orderId = ofJoin.order_id
        }
      } catch (e) {
        // Swallow
      }
    }

    if (!orderId) {
      console.warn(`[Fulfillment Created Subscriber] ⚠️ Could not resolve order_id from event payload, skipping`)
      return
    }

    // ---------------------------------------------------
    // STEP 2: Idempotency check - avoid duplicate emails
    // ---------------------------------------------------
    if (recentlySentOrderIds.has(orderId)) {
      console.log(`[Fulfillment Created Subscriber] ℹ️ Skipping Order ${orderId} — shipment email already sent recently (idempotency guard)`)
      return
    }

    // ---------------------------------------------------
    // STEP 3: Fetch order details
    // ---------------------------------------------------
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "currency_code",
        "email",
        "status",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.address_1",
        "shipping_address.address_2",
        "shipping_address.city",
        "shipping_address.province",
        "shipping_address.postal_code",
        "shipping_address.phone",
        "items.title",
        "items.unit_price",
        "items.detail.quantity",
      ],
      filters: { id: orderId },
    })

    if (!order || !order.email) {
      console.warn(`[Fulfillment Created Subscriber] ❌ Order ${orderId} has no email or doesn't exist, aborting`)
      return
    }

    // ---------------------------------------------------
    // STEP 4: Fetch tracking info
    // ---------------------------------------------------
    let trackingNumber = "Will be shared by courier partner shortly"
    let trackingLink: string | null = null

    if (fulfillmentId) {
      try {
        const { data: [fulfillment] } = await query.graph({
          entity: "fulfillment",
          fields: ["id", "labels.tracking_number", "labels.tracking_url"],
          filters: { id: fulfillmentId },
        })
        const nums = fulfillment?.labels?.map((l: any) => l.tracking_number).filter(Boolean)
        if (nums?.length) trackingNumber = nums.join(", ")
        const url = fulfillment?.labels?.[0]?.tracking_url
        if (url && url !== "#" && url.trim()) trackingLink = url
      } catch (_) {
        // ignore
      }
    }

    // ---------------------------------------------------
    // STEP 5: Compose email
    // ---------------------------------------------------
    const firstName = order.shipping_address?.first_name || "Customer"
    const displayId = order.display_id || order.id.substring(0, 10)
    const currency = order.currency_code?.toUpperCase() || "INR"

    const addrParts: string[] = []
    if (order.shipping_address) {
      const sa: any = order.shipping_address
      if (sa.address_1) addrParts.push(sa.address_1)
      if (sa.address_2) addrParts.push(sa.address_2)
      if (sa.city) addrParts.push(sa.city)
      if (sa.province) addrParts.push(sa.province)
      if (sa.postal_code) addrParts.push(sa.postal_code)
    }
    const addressStr = addrParts.length > 0 ? addrParts.join(", ") : "Your registered delivery address."

    const itemsHtml = (order.items || [])
      .map((item: any) => {
        const qty = item.detail?.quantity ?? item.quantity ?? 1
        const total = ((item.unit_price ?? 0) * qty)
        return `
          <tr style="border-bottom: 1px solid #f1f3f5;">
            <td style="padding: 10px 0; color: #2d3748;">${item.title}</td>
            <td style="padding: 10px 0; text-align: center; color: #718096;">${qty}</td>
            <td style="padding: 10px 0; text-align: right; color: #2d3748;">${currency} ${total.toFixed(2)}</td>
          </tr>
        `
      })
      .join("") || "<tr><td colspan='3' style='padding:10px;text-align:center;color:#718096;'>No items listed</td></tr>"

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 12px -1px rgba(19, 108, 57, 0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 42px; margin-bottom: 8px;">📦</div>
          <h2 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(135deg, #0b2545 0%, #136c39 50%, #eb7f23 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Your Order Is Being Processed & Packed</h2>
          <p style="color: #4a5568; font-size: 15px; margin: 0;">Great news, ${firstName}! Your order has been queued for dispatch 🚀</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;" />
        <p style="color: #2d3748; font-size: 15px; line-height: 1.6;">Dear ${firstName},</p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
          We are pleased to inform you that your order <strong style="color: #136c39;">#${displayId}</strong> has been
          successfully fulfilled by our warehouse team and is being prepared for dispatch. Shipment confirmation with live tracking will follow shortly.
        </p>

        <div style="background: linear-gradient(135deg, rgba(19, 108, 57, 0.06) 0%, rgba(254, 208, 0, 0.06) 100%); border: 1px solid rgba(19, 108, 57, 0.12); padding: 18px 20px; border-radius: 10px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; color: #2d3748; font-size: 14px;"><strong>📋 Fulfillment Summary</strong></p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Order ID:</strong> #${displayId}</p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Processed On:</strong> ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Tracking No:</strong> ${trackingNumber}</p>
          ${trackingLink ? `<p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Live Tracking:</strong> <a href="${trackingLink}" target="_blank" style="color: #136c39; font-weight: 700; text-decoration: underline;">Track Order →</a></p>` : ""}
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Shipping To:</strong> ${addressStr}</p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Est. Dispatch:</strong> Within 24 hours</p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Est. Delivery:</strong> Within 3-5 business days</p>
          ${order.shipping_address?.phone ? `<p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;"><strong style="color: #0b2545; display: inline-block; min-width: 120px;">Contact:</strong> ${order.shipping_address.phone}</p>` : ""}
        </div>

        <h4 style="color: #2d3748; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">Order Items:</h4>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0 24px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #edf2f7; text-align: left;">
              <th style="padding-bottom: 10px; color: #4a5568; font-weight: 600; font-size: 13px;">Product</th>
              <th style="padding-bottom: 10px; text-align: center; color: #4a5568; font-weight: 600; font-size: 13px;">Qty</th>
              <th style="padding-bottom: 10px; text-align: right; color: #4a5568; font-weight: 600; font-size: 13px;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #eb7f23; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
            💡 <strong style="color: #9a3412;">Next Steps:</strong><br/>
            1. Your package is being packed with care right now.<br/>
            2. Once handed over to courier, you will receive a <strong>separate "Shipped" email</strong> with live tracking details.<br/>
            3. Please keep your phone handy — courier may call on ${order.shipping_address?.phone || "your registered number"} before delivery.
          </p>
        </div>

        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 24px;">
          Thank you for choosing Ocean Student Projects! 🙏<br/>
          Our team is excited to ship these components out to you. If you need anything, just reply to this email.
        </p>

        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <p style="color: #4a5568; font-size: 13px; line-height: 1.55; text-align: center; margin: 0;">
          For support queries, reply to this email or contact our team.<br/>
          <strong style="color: #136c39;">Happy building! 💚</strong>
        </p>

        <div style="text-align: center; margin-top: 28px; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #718096;">Ocean Student Projects</p>
          <p style="margin: 0;">No.10 Kareem Mohideen sahib St, Chintadripet, Chennai - 600002, Tamil Nadu, India.</p>
        </div>
      </div>
    `

    // ---------------------------------------------------
    // STEP 6: Send email
    // ---------------------------------------------------
    const subject = `📦 Order Processed - #${displayId} is being packed for dispatch (Ocean Student Projects)`

    console.log(`[Fulfillment Created Subscriber] 📤 Sending Fulfillment Confirmation to ${order.email} for Order #${displayId}`)

    await sendMail({
      to: order.email,
      subject,
      html: emailHtml,
    })

    // Register in idempotency set to avoid duplicate emails
    recentlySentOrderIds.add(orderId)
    setTimeout(() => recentlySentOrderIds.delete(orderId!), IDEMPOTENCY_TTL_MS)

    console.log(`[Fulfillment Created Subscriber] ✅ Fulfillment confirmation email sent to ${order.email} for Order #${displayId}`)

  } catch (err: any) {
    console.error("[Fulfillment Created Subscriber] ❌ Fatal error:", err?.message || err)
  }
}

export const config: SubscriberConfig = {
  event: "fulfillment.created",
}
