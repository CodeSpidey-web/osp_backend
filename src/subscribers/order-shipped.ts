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

export default async function orderShippedHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const query = container.resolve("query")

  try {
    console.log(`[Order Shipped Subscriber] 🚀 Received event: ${event.name}, data keys: ${Object.keys(event.data || {}).join(", ")}`)

    let fulfillmentId: string | null = null
    let orderId: string | null = null

    if (event.data?.id && typeof event.data.id === "string") {
      fulfillmentId = event.data.id
    }
    if (!fulfillmentId && event.data?.fulfillment_id) {
      fulfillmentId = event.data.fulfillment_id
    }
    if (event.data?.order_id) {
      orderId = event.data.order_id
    }
    if (!fulfillmentId && !orderId && event.data?.data) {
      const inner = event.data.data
      if (inner.id) fulfillmentId = inner.id
      if (inner.fulfillment_id) fulfillmentId = inner.fulfillment_id
      if (inner.order_id) orderId = inner.order_id
    }

    if (!fulfillmentId && !orderId) {
      console.warn(
        `[Order Shipped Subscriber] ⚠️ Could not resolve fulfillmentId or orderId from event payload. ` +
        `Event: ${event.name}. Data: ${JSON.stringify(event.data)}`
      )
      return
    }

    if (!orderId && fulfillmentId) {
      try {
        const { data: [orderFulfillment] } = await query.graph({
          entity: "order_fulfillment",
          fields: ["order_id"],
          filters: { fulfillment_id: fulfillmentId },
        })
        if (orderFulfillment?.order_id) {
          orderId = orderFulfillment.order_id
          console.log(`[Order Shipped Subscriber] Resolved order_id ${orderId} via order_fulfillment join`)
        }
      } catch (ofErr) {
        console.warn(`[Order Shipped Subscriber] order_fulfillment lookup failed, trying fulfillment entity directly`)
      }

      if (!orderId) {
        try {
          const { data: [fulfillmentRec] }: any = await query.graph({
            entity: "fulfillment",
            fields: ["id", "order_id"],
            filters: { id: fulfillmentId },
          })
          if (fulfillmentRec?.order_id) {
            orderId = fulfillmentRec.order_id
            console.log(`[Order Shipped Subscriber] Resolved order_id ${orderId} via fulfillment.order_id`)
          }
        } catch (fErr) {
          console.warn(`[Order Shipped Subscriber] fulfillment lookup also failed`)
        }
      }
    }

    if (!orderId) {
      console.warn(`[Order Shipped Subscriber] ❌ Could not resolve orderId. Aborting email.`)
      return
    }

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "currency_code",
        "email",
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
      console.warn(`[Order Shipped Subscriber] ❌ Order not found or has no email: ${orderId}`)
      return
    }

    let trackingNumber = "Will be shared by courier partner"
    let courierName: string | null = null

    if (fulfillmentId) {
      try {
        const { data: [fulfillment] } = await query.graph({
          entity: "fulfillment",
          fields: [
            "id",
            "metadata",
            "labels.tracking_number",
          ],
          filters: { id: fulfillmentId },
        })

        const metadataCourier = fulfillment?.metadata?.courier_name
        if (typeof metadataCourier === "string") {
          courierName = metadataCourier
        }

        const labelNums = fulfillment?.labels
          ?.map((l: any) => l.tracking_number)
          .filter(Boolean)

        if (labelNums && labelNums.length > 0) {
          trackingNumber = labelNums.join(", ")
        }
      } catch (trackErr) {
        console.warn(`[Order Shipped Subscriber] ⚠️ Could not fetch tracking labels:`, trackErr)
      }
    }

    const firstName = escapeHtml(order.shipping_address?.first_name || "Customer")
    const displayId = escapeHtml(String(order.display_id || order.id.substring(0, 10)))
    const currency = order.currency_code?.toUpperCase() || "INR"

    const shippingAddrParts: string[] = []
    if (order.shipping_address) {
      const sa: any = order.shipping_address
      if (sa.address_1) shippingAddrParts.push(sa.address_1)
      if (sa.address_2) shippingAddrParts.push(sa.address_2)
      if (sa.city) shippingAddrParts.push(sa.city)
      if (sa.province) shippingAddrParts.push(sa.province)
      if (sa.postal_code) shippingAddrParts.push(sa.postal_code)
    }
    const shippingAddressText = shippingAddrParts.length > 0
      ? escapeHtml(shippingAddrParts.join(", "))
      : "Your registered delivery address."

    const itemRows: OrderItemRow[] = (order.items || [])
      .map((item: any) => {
        const qty = item.detail?.quantity ?? item.quantity ?? 1
        const lineTotal = (item.unit_price ?? 0) * qty
        return {
          title: item.title,
          quantity: qty,
          amount: `${currency} ${Number(lineTotal).toFixed(2)}`,
        }
      })

    const summaryRows: Array<[string, string]> = [
      ["Order ID", `<strong style="color: ${BRAND.colors.green};">#${displayId}</strong>`],
      ["Shipped On", new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
    ]
    if (courierName) summaryRows.push(["Courier", escapeHtml(courierName)])
    summaryRows.push(["Tracking No", escapeHtml(trackingNumber)])
    summaryRows.push(["Delivery To", shippingAddressText])
    summaryRows.push(["Est. Delivery", "Within 3-5 business days"])
    if (order.shipping_address?.phone) {
      summaryRows.push(["Contact", escapeHtml(order.shipping_address.phone)])
    }

    const profileHref = `${getStorefrontUrl()}/profile`
    const contactPhoneHtml = order.shipping_address?.phone
      ? `<strong>${escapeHtml(order.shipping_address.phone)}</strong>`
      : "your registered phone number"

    const body = `
      <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Dear ${firstName},
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
        We are pleased to inform you that your order <strong style="color: ${BRAND.colors.green};">#${displayId}</strong> has been
        shipped and is on the way to your delivery address.
      </p>

      ${renderSummaryCard("Shipment Details", summaryRows, "📦")}

      <h4 style="color: ${BRAND.colors.textPrimary}; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
        Your Shipment Contains
      </h4>
      ${renderOrderItemsTable(itemRows)}

      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid ${BRAND.colors.orange}; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
          💡 <strong style="color: #9a3412;">Important Delivery Tip:</strong><br/>
          Please keep your phone handy near the delivery date — the courier partner may call you before attempting delivery.
          Expect a confirmation call on ${contactPhoneHtml}.
        </p>
      </div>

      <div style="text-align: center;">
        ${renderButton({ label: "Track Order in Profile", href: profileHref, variant: "primary" })}
      </div>

      <p style="color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65; margin: 24px 0 0 0;">
        Thank you for choosing <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong>! 🙏<br/>
        We are excited to be part of your engineering journey. Share your build experience with us on Instagram!
      </p>

      <p style="color: ${BRAND.colors.textMuted}; font-size: 13px; line-height: 1.6; text-align: center; margin: 28px 0 0 0;">
        For any delivery queries, reply to this email or contact our support team.<br/>
        <strong style="color: ${BRAND.colors.green};">Happy building! 💚</strong>
      </p>
    `

    const emailHtml = renderBrandedEmail({
      previewText: `Order #${displayId} is on its way 🚚`,
      heroEmoji: "🚚",
      heroHeading: "Your Order Has Shipped!",
      heroSubheading: `Great news, ${order.shipping_address?.first_name || "Customer"}! Your package is on its way 🎉`,
      body,
    })

    const emailSubject = `🚚 Shipped! Your ${BRAND.name} Order #${order.display_id || order.id.substring(0, 10)} is on the way`

    console.log(`[Order Shipped Subscriber] 📤 Sending shipment email for Order #${displayId} to ${order.email} (via event: ${event.name})...`)

    await sendMail({
      to: order.email,
      subject: emailSubject,
      html: emailHtml,
    })

    console.log(`[Order Shipped Subscriber] ✅ Shipment email sent successfully to ${order.email} for Order #${displayId}`)

  } catch (error: any) {
    console.error("[Order Shipped Subscriber] ❌ FATAL Error executing handler:", error?.message || error)
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
