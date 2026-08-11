import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"
import {
  BRAND,
  renderBrandedEmail,
  renderButton,
  renderSummaryCard,
  renderOrderItemsTable,
  escapeHtml,
  getStorefrontUrl,
  OrderItemRow,
} from "../utils/emailLayout"

const recentlySentOrderIds = new Set<string>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000

export default async function orderFulfillmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const query = container.resolve("query")

  try {
    console.log(`[Fulfillment Created Subscriber] 🚀 Received event: ${event.name}`)

    let orderId: string | null = null
    let fulfillmentId: string | null = null
    const payload = event.data || {}

    if (payload.order_id) orderId = payload.order_id
    if (payload.id) fulfillmentId = payload.id
    if (!orderId && payload.data?.order_id) orderId = payload.data.order_id
    if (!fulfillmentId && payload.data?.id) fulfillmentId = payload.data.id

    if (!orderId && fulfillmentId) {
      try {
        const { data: [ofJoin] } = await query.graph({
          entity: "order_fulfillment",
          fields: ["order_id"],
          filters: { fulfillment_id: fulfillmentId },
        })
        if (ofJoin?.order_id) orderId = ofJoin.order_id
      } catch (e) {
        // ignore
      }
    }

    if (!orderId) {
      console.warn(`[Fulfillment Created Subscriber] ⚠️ Could not resolve order_id from event payload, skipping`)
      return
    }

    if (recentlySentOrderIds.has(orderId)) {
      console.log(`[Fulfillment Created Subscriber] ℹ️ Skipping Order ${orderId} — shipment email already sent recently (idempotency guard)`)
      return
    }

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

    const firstName = escapeHtml(order.shipping_address?.first_name || "Customer")
    const displayId = escapeHtml(String(order.display_id || order.id.substring(0, 10)))
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
    const addressStr = addrParts.length > 0 ? escapeHtml(addrParts.join(", ")) : "Your registered delivery address."

    const itemRows: OrderItemRow[] = (order.items || [])
      .map((item: any) => {
        const qty = item.detail?.quantity ?? item.quantity ?? 1
        const total = (item.unit_price ?? 0) * qty
        return {
          title: item.title,
          quantity: qty,
          amount: `${currency} ${Number(total).toFixed(2)}`,
        }
      })

    const summaryRows: Array<[string, string]> = [
      ["Order ID", `<strong style="color: ${BRAND.colors.green};">#${displayId}</strong>`],
      ["Processed On", new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
      ["Tracking No", escapeHtml(trackingNumber)],
    ]
    if (trackingLink) {
      summaryRows.push(["Live Tracking", `<a href="${escapeHtml(trackingLink)}" target="_blank" style="color: ${BRAND.colors.green}; font-weight: 700; text-decoration: underline;">Track Order →</a>`])
    }
    summaryRows.push(["Shipping To", addressStr])
    summaryRows.push(["Est. Dispatch", "Within 24 hours"])
    summaryRows.push(["Est. Delivery", "Within 3-5 business days"])
    if (order.shipping_address?.phone) {
      summaryRows.push(["Contact", escapeHtml(order.shipping_address.phone)])
    }

    const profileHref = `${getStorefrontUrl()}/profile`
    const phoneHtml = order.shipping_address?.phone
      ? `<strong>${escapeHtml(order.shipping_address.phone)}</strong>`
      : "your registered number"

    const body = `
      <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Dear ${firstName},
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
        We are pleased to inform you that your order <strong style="color: ${BRAND.colors.green};">#${displayId}</strong> has been
        successfully fulfilled by our warehouse team and is being prepared for dispatch. Shipment confirmation with live tracking will follow shortly.
      </p>

      ${renderSummaryCard("Fulfillment Summary", summaryRows, "📋")}

      <h4 style="color: ${BRAND.colors.textPrimary}; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
        Order Items
      </h4>
      ${renderOrderItemsTable(itemRows)}

      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid ${BRAND.colors.orange}; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
          💡 <strong style="color: #9a3412;">Next Steps:</strong><br/>
          1. Your package is being packed with care right now.<br/>
          2. Once handed over to courier, you will receive a <strong>separate "Shipped" email</strong> with live tracking details.<br/>
          3. Please keep your phone handy — courier may call on ${phoneHtml} before delivery.
        </p>
      </div>

      <div style="text-align: center;">
        ${renderButton({ label: "View Order in Profile", href: profileHref, variant: "primary" })}
      </div>

      <p style="color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65; margin: 24px 0 0 0;">
        Thank you for choosing <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong>! 🙏<br/>
        Our team is excited to ship these components out to you. If you need anything, just reply to this email.
      </p>

      <p style="color: ${BRAND.colors.textMuted}; font-size: 13px; line-height: 1.6; text-align: center; margin: 28px 0 0 0;">
        For support queries, reply to this email or contact our team.<br/>
        <strong style="color: ${BRAND.colors.green};">Happy building! 💚</strong>
      </p>
    `

    const emailHtml = renderBrandedEmail({
      previewText: `Order #${displayId} is being packed 📦`,
      heroEmoji: "📦",
      heroHeading: "Your Order Is Being Processed & Packed",
      heroSubheading: `Great news, ${order.shipping_address?.first_name || "Customer"}! Your order has been queued for dispatch 🚀`,
      body,
    })

    const subject = `📦 Order Processed - #${displayId} is being packed for dispatch (${BRAND.name})`

    console.log(`[Fulfillment Created Subscriber] 📤 Sending Fulfillment Confirmation to ${order.email} for Order #${displayId}`)

    await sendMail({
      to: order.email,
      subject,
      html: emailHtml,
    })

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
