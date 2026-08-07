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
      "payment_collections.status",
      "payment_collections.captured_amount",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
    ],
  })

  const mapped = orders.map((o: any) => {
    const totalVal = o.summary?.current_order_total?.numeric_ ?? 
                    o.total?.numeric_ ?? 
                    o.summary?.current_order_total ?? 
                    o.total ?? 
                    0;

    const hasCapturedPayment = o.payment_collections?.some(
      (pc: any) => pc.status === "completed" || (pc.captured_amount && Number(pc.captured_amount) > 0)
    );
    const resolvedPaymentStatus = hasCapturedPayment ? "captured" : "not_paid";

    let resolvedFulfillmentStatus = "not_fulfilled";
    if (o.fulfillments && o.fulfillments.length > 0) {
      const isShipped = o.fulfillments.some((f: any) => f.shipped_at || f.delivered_at);
      resolvedFulfillmentStatus = isShipped ? "shipped" : "fulfilled";
    }

    return {
      ...o,
      total: totalVal,
      custom_status: mapStatus(resolvedFulfillmentStatus, resolvedPaymentStatus),
    };
  })

  res.json({ orders: mapped })
}

function mapStatus(fulfillment: string, payment: string): string {
  if (fulfillment === "fulfilled" || fulfillment === "shipped") return "Delivered"
  if (fulfillment === "partially_fulfilled" || payment === "captured") return "Processing"
  return "Pending"
}
