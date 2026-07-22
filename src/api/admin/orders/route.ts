import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "fulfillment_status",
      "payment_status",
      "total",
      "currency_code",
      "email",
      "created_at",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.city",
      "items.title",
      "items.quantity",
      "summary.current_order_total",
    ],
  })

  const mapped = orders.map((o: any) => ({
    ...o,
    custom_status: mapStatus(o.fulfillment_status, o.payment_status),
  }))

  res.json({ orders: mapped })
}

function mapStatus(fulfillment: string, payment: string): string {
  if (fulfillment === "fulfilled" || fulfillment === "shipped") return "Delivered"
  if (fulfillment === "partially_fulfilled" || payment === "captured") return "Processing"
  return "Pending"
}
