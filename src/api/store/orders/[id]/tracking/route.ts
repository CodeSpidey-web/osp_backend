import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /store/orders/:id/tracking
// Returns the courier + tracking details for the customer's own order.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params;
  const customerId = (req as any).auth_context?.actor_id;

  if (!customerId) {
    return res.status(401).json({ message: "You must be logged in to view order tracking." });
  }

  const query = req.scope.resolve("query");

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "customer_id",
        "fulfillments.shipped_at",
        "fulfillments.metadata",
        "fulfillments.labels.tracking_number",
        "fulfillments.labels.tracking_url",
      ],
      filters: { id },
    });

    const order = orders[0];

    if (!order || order.customer_id !== customerId) {
      return res.status(404).json({ message: "Order not found." });
    }

    let courierName: string | null = null;
    let trackingNumber: string | null = null;
    let trackingUrl: string | null = null;

    const fulfillments: any[] = order.fulfillments || [];
    for (const fulfillment of fulfillments) {
      const courierFromMetadata = fulfillment?.metadata?.courier_name;
      if (typeof courierFromMetadata === "string") {
        courierName = courierFromMetadata;
      }
      for (const label of fulfillment?.labels || []) {
        if (label.tracking_number) {
          trackingNumber = label.tracking_number;
          trackingUrl = label.tracking_url && label.tracking_url !== "#" ? label.tracking_url : null;
          break;
        }
      }
      if (trackingNumber) break;
    }

    const isShipped = (order.fulfillments || []).some(
      (f: any) => f.shipped_at
    );

    res.json({
      tracking: {
        shipped: isShipped,
        courier_name: courierName,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error?.message || "An error occurred fetching tracking." });
  }
}