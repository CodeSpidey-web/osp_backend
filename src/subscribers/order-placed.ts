import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"
import {
  BRAND,
  renderBrandedEmail,
  renderButton,
  renderSummaryCard,
  renderOrderItemsTable,
  renderTotalsTable,
  escapeHtml,
  getStorefrontUrl,
  OrderItemRow,
  TotalsRow,
} from "../utils/emailLayout"

export default async function orderPlacedHandler({
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
        "shipping_address.address_1",
        "shipping_address.city",
        "items.title",
        "items.unit_price",
        "items.detail.quantity",
        "shipping_methods.name",
        "shipping_methods.amount"
      ],
      filters: {
        id: orderId
      }
    })

    if (!order || !order.email) {
      console.warn(`[Order Placed Subscriber] Order not found or no email: ${orderId}`)
      return
    }

    const db = container.resolve("__pg_connection__") as any
    let grandTotal = order.total
    let itemRate = 18
    let shippingRate = 18
    try {
      const [sumRes, taxRes, shipTaxRes] = await Promise.all([
        db.raw(
          "SELECT totals FROM order_summary WHERE order_id = ? ORDER BY version DESC LIMIT 1",
          [orderId]
        ),
        db.raw(
          "SELECT rate FROM tax_rate WHERE is_default = true AND tax_region_id = (SELECT id FROM tax_region WHERE country_code = 'in' LIMIT 1) LIMIT 1"
        ),
        db.raw("SELECT rate FROM tax_rate WHERE code = 'GST_SHIPPING' LIMIT 1"),
      ])
      grandTotal =
        Array.isArray(sumRes.rows) && sumRes.rows[0]?.totals?.current_order_total
          ? sumRes.rows[0].totals.current_order_total
          : order.total
      if (taxRes.rows[0]?.rate) itemRate = Number(taxRes.rows[0].rate)
      if (shipTaxRes.rows[0]?.rate) shippingRate = Number(shipTaxRes.rows[0].rate)
    } catch (err) {
      console.warn("[Order Placed Subscriber] Could not read order summary totals:", err)
    }

    const subtotal = (order.items || []).reduce(
      (s, i) => s + ((i?.unit_price ?? 0) * (i?.detail?.quantity ?? i?.quantity ?? 1)),
      0
    )
    const shipping = (order.shipping_methods || []).reduce(
      (s, m) => s + (m?.amount ?? 0),
      0
    )
    const itemGst = (order.items || []).reduce(
      (s, i) =>
        s +
        ((i?.unit_price ?? 0) * (i?.detail?.quantity ?? i?.quantity ?? 1) * itemRate) /
          (100 + itemRate),
      0
    )
    const shippingGst = (shipping * shippingRate) / (100 + shippingRate)
    const gstIncluded = itemGst + shippingGst

    const firstName = escapeHtml(order.shipping_address?.first_name || "Customer")
    const currency = order.currency_code?.toUpperCase() || "INR"
    const displayId = escapeHtml(String(order.display_id || order.id))

    const itemRows: OrderItemRow[] = (order.items || []).map((item: any) => {
      const qty = item.detail?.quantity ?? item.quantity ?? 1
      const unit = item.unit_price ?? 0
      const lineTotal = unit * qty
      return {
        title: item.title,
        quantity: qty,
        amount: `${currency} ${Number(lineTotal).toFixed(2)}`,
      }
    })

    const totalsRows: TotalsRow[] = [
      { label: "Subtotal", value: `${currency} ${Number(subtotal).toFixed(2)}` },
      { label: "Shipping", value: `${currency} ${Number(shipping).toFixed(2)}` },
      { label: "GST (included)", value: `${currency} ${Number(gstIncluded).toFixed(2)}` },
      {
        label: "Grand Total",
        value: `${currency} ${Number(grandTotal).toFixed(2)}`,
        highlighted: true,
      },
    ]

    const storefrontUrl = getStorefrontUrl()
    const orderHref = `${storefrontUrl}/profile`

    const body = `
      <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
        Dear ${firstName},
      </p>
      <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
        Thank you for shopping with <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong>!
        We have received your order and are currently processing it. Here is a copy of your receipt:
      </p>

      ${renderSummaryCard(
        "Order Information",
        [
          ["Order ID", `<strong style="color: ${BRAND.colors.green};">#${displayId}</strong>`],
          ["Date", new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })],
          ["Status", "Order Received — Processing"],
        ],
        "🧾"
      )}

      <h4 style="color: ${BRAND.colors.textPrimary}; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
        Products Ordered
      </h4>
      ${renderOrderItemsTable(itemRows)}

      ${renderTotalsTable(totalsRows)}

      <div style="text-align: center;">
        ${renderButton({ label: "View Orders & Tracking", href: orderHref, variant: "primary" })}
      </div>

      <p style="color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65; margin: 24px 0 0 0; text-align: center;">
        If you have any questions, reply to this email or call us at
        <a href="tel:${escapeHtml(BRAND.contact.phoneHref)}" style="color: ${BRAND.colors.green}; font-weight: 600; text-decoration: none;"> ${escapeHtml(BRAND.contact.phone)}</a>.
      </p>

      <p style="color: ${BRAND.colors.textMuted}; font-size: 13px; line-height: 1.6; text-align: center; margin: 28px 0 0 0;">
        Thank you for choosing us! 💚<br/>
        <strong style="color: ${BRAND.colors.green};">The ${escapeHtml(BRAND.shortName)} Team</strong>
      </p>
    `

    const emailHtml = renderBrandedEmail({
      previewText: `Your order #${displayId} receipt from ${BRAND.name}`,
      heroEmoji: "🧾",
      heroHeading: "Order Confirmed!",
      heroSubheading: `Thank you for shopping with ${BRAND.name}.`,
      body,
    })

    await sendMail({
      to: order.email,
      subject: `Your ${BRAND.name} Order Receipt - #${order.display_id || order.id}`,
      html: emailHtml
    })

  } catch (error) {
    console.error("[Order Placed Subscriber] Error executing handler:", error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
