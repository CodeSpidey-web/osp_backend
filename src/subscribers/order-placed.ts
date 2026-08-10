import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { sendMail } from "../utils/mail"

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

    // Read the authoritative tax-inclusive grand total from the order summary,
    // plus the GST rates used for the itemized breakdown.
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

    // Compute the receipt breakdown (values in minor units / paise)
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

    const firstName = order.shipping_address?.first_name || "Customer"
    const itemsListHtml = order.items
      ?.map((item: any) => `
        <tr style="border-bottom: 1px solid #f1f3f5;">
          <td style="padding: 10px 0; color: #2d3748;">${item.title}</td>
          <td style="padding: 10px 0; text-align: center; color: #718096;">${item.detail?.quantity ?? item.quantity}</td>
          <td style="padding: 10px 0; text-align: right; color: #2d3748;">${order.currency_code.toUpperCase()} ${(item.unit_price ?? 0).toFixed(2)}</td>
          <td style="padding: 10px 0; text-align: right; color: #2d3748;">${order.currency_code.toUpperCase()} ${((item.unit_price ?? 0) * (item.detail?.quantity ?? item.quantity ?? 1)).toFixed(2)}</td>
        </tr>
      `).join("") || ""

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #136c39; font-size: 24px; font-weight: 700; margin: 0 0 10px 0;">Order Confirmed!</h2>
          <p style="color: #4a5568; font-size: 16px; margin: 0;">Thank you for shopping with Ocean Student Projects.</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;" />
        <p style="color: #2d3748; font-size: 15px; line-height: 1.6;">Dear ${firstName},</p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">We have received your order and are currently processing it. Here is a copy of your receipt:</p>
        
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #4a5568; font-size: 14px;"><strong>Order ID:</strong> #${order.display_id || order.id}</p>
          <p style="margin: 0; color: #4a5568; font-size: 14px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #edf2f7; text-align: left;">
              <th style="padding-bottom: 8px; color: #4a5568; font-weight: 600;">Product</th>
              <th style="padding-bottom: 8px; text-align: center; color: #4a5568; font-weight: 600;">Qty</th>
              <th style="padding-bottom: 8px; text-align: right; color: #4a5568; font-weight: 600;">Price</th>
              <th style="padding-bottom: 8px; text-align: right; color: #4a5568; font-weight: 600;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tbody>
            <tr>
              <td style="padding: 6px 0; color: #4a5568; font-size: 14px;">Subtotal</td>
              <td style="padding: 6px 0; text-align: right; color: #2d3748; font-size: 14px; font-weight: 600;">${order.currency_code.toUpperCase()} ${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #4a5568; font-size: 14px;">Shipping</td>
              <td style="padding: 6px 0; text-align: right; color: #2d3748; font-size: 14px; font-weight: 600;">${order.currency_code.toUpperCase()} ${shipping.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #4a5568; font-size: 14px;">GST (included)</td>
              <td style="padding: 6px 0; text-align: right; color: #2d3748; font-size: 14px; font-weight: 600;">${order.currency_code.toUpperCase()} ${gstIncluded.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 2px solid #edf2f7;">
              <td style="padding: 12px 0 0 0; font-weight: 700; color: #2d3748;">Grand Total</td>
              <td style="padding: 12px 0 0 0; text-align: right; font-weight: 700; color: #136c39; font-size: 18px;">${order.currency_code.toUpperCase()} ${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <p style="color: #4a5568; font-size: 14px; line-height: 1.5; text-align: center; margin: 0;">
          If you have any questions, feel free to reply to this email or contact our support team.
        </p>
        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #a0aec0;">
          <p style="margin: 0 0 5px 0;">Ocean Student Projects</p>
          <p style="margin: 0;">No.10 Kareem Mohideen sahib St, Chintadripet, Chennai - 600002, Tamil Nadu, India.</p>
        </div>
      </div>
    `

    await sendMail({
      to: order.email,
      subject: `Your Ocean Student Projects Order Receipt - #${order.display_id || order.id}`,
      html: emailHtml
    })

  } catch (error) {
    console.error("[Order Placed Subscriber] Error executing handler:", error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
