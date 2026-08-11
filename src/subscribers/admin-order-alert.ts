import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"
import {
  BRAND,
  OrderItemRow,
  escapeHtml,
  getBackendUrl,
  renderBrandedEmail,
  renderButton,
  renderOrderItemsTable,
  renderSummaryCard,
  renderTotalsTable,
  TotalsRow,
} from "../utils/emailLayout"

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
        "items.detail.quantity",
        "items.unit_price",
        "items.thumbnail",
        "items.variant_title",
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
    const currency = (order.currency_code || "INR").toUpperCase()

    const itemRows: OrderItemRow[] = (order.items || []).map((item: any) => ({
      title: item.title + (item.variant_title ? ` (${item.variant_title})` : ""),
      quantity: item.detail?.quantity ?? item.quantity ?? 1,
      amount: `${currency} ${Number(item.unit_price ?? 0).toFixed(2)}`,
    }))

    const totals: TotalsRow[] = [
      {
        label: "Grand Total (Authoritative)",
        value: `${currency} ${Number(grandTotal).toFixed(2)}`,
        highlighted: true,
      },
    ]

    const adminOrdersUrl = `${getBackendUrl()}/app/orders`
    const orderIdText = `#${order.display_id || order.id}`
    const customerEmailEscaped = escapeHtml(order.email)
    const greenColor = BRAND.colors.green
    const customerCellHtml = `${customerName} <a href="mailto:${customerEmailEscaped}" style="color:${greenColor};text-decoration:underline;">${customerEmailEscaped}</a>`

    const summaryRows: [string, string][] = [
      ["Order ID", orderIdText],
      ["Customer", customerCellHtml],
      ["Items Count", String(order.items?.length ?? 0)],
    ]

    const emailHtml = renderBrandedEmail({
      previewText: `🚨 New order #${order.display_id || order.id} from ${customerName} · Total ${currency} ${Number(grandTotal).toFixed(2)}`,
      heroEmoji: "🚨",
      heroHeading: "New Order Received",
      heroSubheading: `A new customer order has just been placed on ${BRAND.name}.`,
      body: `
        ${renderSummaryCard("Order Summary", summaryRows, "🛒")}
        <div style="height:22px;"></div>
        ${renderOrderItemsTable(itemRows)}
        <div style="height:18px;"></div>
        ${renderTotalsTable(totals)}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="text-align:center;margin-top:28px;">
          <tr>
            <td>
              ${renderButton({ label: "View in Admin Panel", href: adminOrdersUrl, variant: "primary" })}
            </td>
          </tr>
        </table>
      `,
    })

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
