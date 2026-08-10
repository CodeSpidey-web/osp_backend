import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"

export default async function orderShippedHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const query = container.resolve("query")

  try {
    console.log(`[Order Shipped Subscriber] 🚀 Received event: ${event.name}, data keys: ${Object.keys(event.data || {}).join(", ")}`)

    // ---------------------------------------------------
    // STEP 1: Resolve the fulfillmentId robustly from the event payload
    // Different Medusa workflows emit different payload shapes
    // ---------------------------------------------------
    let fulfillmentId: string | null = null
    let orderId: string | null = null

    // Scenario A: event payload has an `id` that is a fulfillment ID (shipment.created or similar)
    if (event.data?.id && typeof event.data.id === "string") {
      fulfillmentId = event.data.id
    }

    // Scenario B: event payload directly has fulfillment_id
    if (!fulfillmentId && event.data?.fulfillment_id) {
      fulfillmentId = event.data.fulfillment_id
    }

    // Scenario C: event payload directly has order_id
    if (event.data?.order_id) {
      orderId = event.data.order_id
    }

    // Scenario D: payload.data pattern
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

    // ---------------------------------------------------
    // STEP 2: Resolve orderId if we don't have it yet
    // ---------------------------------------------------
    if (!orderId && fulfillmentId) {
      // Try order_fulfillment join table first
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

      // Fallback: try to look up fulfillment entity directly for order relationship
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

    // ---------------------------------------------------
    // STEP 3: Fetch full order details
    // ---------------------------------------------------
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

    // ---------------------------------------------------
    // STEP 4: Fetch tracking info from fulfillment labels
    // ---------------------------------------------------
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

    // ---------------------------------------------------
    // STEP 5: Compose and send the email
    // ---------------------------------------------------
    const firstName = order.shipping_address?.first_name || "Customer"
    const displayId = order.display_id || order.id.substring(0, 10)
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
      ? shippingAddrParts.join(", ")
      : "Your registered delivery address."

    const itemsListHtml = (order.items || [])
      .map((item: any) => {
        const qty = item.detail?.quantity ?? item.quantity ?? 1
        const lineTotal = ((item.unit_price ?? 0) * qty)
        return `
          <tr style="border-bottom: 1px solid #f1f3f5;">
            <td style="padding: 10px 0; color: #2d3748;">${item.title}</td>
            <td style="padding: 10px 0; text-align: center; color: #718096;">${qty}</td>
            <td style="padding: 10px 0; text-align: right; color: #2d3748;">${currency} ${lineTotal.toFixed(2)}</td>
          </tr>
        `
      })
      .join("") || "<tr><td colspan='3' style='padding:10px;text-align:center;color:#718096;'>No items listed</td></tr>"

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 12px -1px rgba(19, 108, 57, 0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 42px; margin-bottom: 8px;">🚚</div>
          <h2 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(135deg, #0b2545 0%, #136c39 50%, #eb7f23 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Your Order Has Shipped!</h2>
          <p style="color: #4a5568; font-size: 15px; margin: 0;">Great news, ${firstName}! Your package is on its way 🎉</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;" />
        <p style="color: #2d3748; font-size: 15px; line-height: 1.6;">Dear ${firstName},</p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
          We are pleased to inform you that your order <strong style="color: #136c39;">#${displayId}</strong> has been
          shipped and is on the way to your delivery address.
        </p>

        <div style="background: linear-gradient(135deg, rgba(19, 108, 57, 0.06) 0%, rgba(254, 208, 0, 0.06) 100%); border: 1px solid rgba(19, 108, 57, 0.12); padding: 18px 20px; border-radius: 10px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; color: #2d3748; font-size: 14px;">
            <strong>📦 Shipment Details</strong>
          </p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Order ID:</strong>
            #${displayId}
          </p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Shipped On:</strong>
            ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          ${courierName ? `
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Courier:</strong>
            ${courierName}
          </p>
          ` : ""}
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Tracking No:</strong>
            ${trackingNumber}
          </p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Delivery To:</strong>
            ${shippingAddressText}
          </p>
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Est. Delivery:</strong>
            Within 3-5 business days
          </p>
          ${order.shipping_address?.phone ? `
          <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
            <strong style="color: #0b2545; display: inline-block; min-width: 120px;">Contact:</strong>
            ${order.shipping_address.phone}
          </p>
          ` : ""}
        </div>

        <h4 style="color: #2d3748; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">Your Shipment Contains:</h4>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0 24px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #edf2f7; text-align: left;">
              <th style="padding-bottom: 10px; color: #4a5568; font-weight: 600; font-size: 13px;">Product</th>
              <th style="padding-bottom: 10px; text-align: center; color: #4a5568; font-weight: 600; font-size: 13px;">Qty</th>
              <th style="padding-bottom: 10px; text-align: right; color: #4a5568; font-weight: 600; font-size: 13px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHtml}
          </tbody>
        </table>

        <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #eb7f23; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
            💡 <strong style="color: #9a3412;">Important Delivery Tip:</strong>
            Please keep your phone handy near the delivery date — the courier partner may call you before attempting delivery.
            ${order.shipping_address?.phone ? `Expect a call on <strong>${order.shipping_address.phone}</strong>.` : `Expect a call on your registered phone number.`}
          </p>
        </div>

        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 24px;">
          Thank you for choosing Ocean Student Projects! 🙏<br/>
          We are excited to be part of your engineering journey. Share your build experience with us on Instagram!
        </p>

        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <p style="color: #4a5568; font-size: 13px; line-height: 1.55; text-align: center; margin: 0;">
          For any delivery queries, reply to this email or reach our support team.<br/>
          <strong style="color: #136c39;">Happy building! 💚</strong>
        </p>

        <div style="text-align: center; margin-top: 28px; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #718096;">Ocean Student Projects</p>
          <p style="margin: 0;">No.10 Kareem Mohideen sahib St, Chintadripet, Chennai - 600002, Tamil Nadu, India.</p>
        </div>
      </div>
    `

    const emailSubject = `🚚 Shipped! Your Ocean Student Projects Order #${displayId} is on the way`

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

// Subscribe to MULTIPLE events that could indicate an order shipped / was fulfilled:
// - shipment.created (primary for Medusa v2 createShipmentWorkflow)
// - fulfillment.created (when fulfillment workflow runs)
// NOTE: Medusa 2.x subscriber config can only have ONE event string per handler file
// (To subscribe to multiple events, duplicate this file with a different name or register programatically)
export const config: SubscriberConfig = {
  event: "shipment.created",
}
