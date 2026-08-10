import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"

export default async function adminOrderAlertHandler({
  event,
  container,
}: SubscriberArgs<any>) {
  const orderId = event.data.id
  const query = container.resolve("query")

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "currency_code",
        "email",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "items.title",
        "items.detail.quantity"
      ],
      filters: {
        id: orderId
      }
    })

    if (!order) {
      console.warn(`[Admin Order Alert Subscriber] Order not found: ${orderId}`)
      return
    }

    // Read the authoritative tax-inclusive grand total from the order summary
    let grandTotal = 0
    try {
      const db = container.resolve("__pg_connection__") as any
      const sumRes = await db.raw(
        "SELECT totals FROM order_summary WHERE order_id = ? ORDER BY version DESC LIMIT 1",
        [orderId]
      )
      grandTotal = sumRes.rows[0]?.totals?.current_order_total ?? 0
    } catch (err) {
      console.warn("[Admin Order Alert Subscriber] Could not read order summary totals:", err)
    }

    const customerName = `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() || "Guest Customer"
    const itemsListHtml = order.items
      ?.map((item: any) => `<li>${item.title} (Qty: ${item.detail?.quantity ?? item.quantity})</li>`)
      .join("") || ""

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #fff8f8;">
        <h2 style="color: #c53030; margin-top: 0;">🚨 Alert: New Order Placed</h2>
        <p>A new order has been received on the Ocean Student Projects store.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border: 1px solid #edf2f7; border-radius: 4px;">
          <tr>
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7; width: 30%;">Order ID:</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">#${order.display_id || order.id}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Customer:</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${customerName} (${order.email})</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Total Amount:</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #136c39; font-weight: bold;">
              ${order.currency_code.toUpperCase()} ${Number(grandTotal).toFixed(2)}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; vertical-align: top;">Items:</td>
            <td style="padding: 10px;">
              <ul style="margin: 0; padding-left: 20px;">
                ${itemsListHtml}
              </ul>
            </td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-top: 25px;">
          <a href="http://localhost:9000/app/orders" target="_blank" style="background-color: #136c39; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            View Order in Admin Panel
          </a>
        </div>
      </div>
    `

    // Send to admin email address: oceanstudentprojects@gmail.com
    await sendMail({
      to: "oceanstudentprojects@gmail.com",
      subject: `🚨 New Order Alert - #${order.display_id || order.id}`,
      html: emailHtml
    })

  } catch (error) {
    console.error("[Admin Order Alert Subscriber] Error executing handler:", error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
