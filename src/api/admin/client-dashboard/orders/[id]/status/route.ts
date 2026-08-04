import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { capturePaymentWorkflow, createOrderFulfillmentWorkflow, createShipmentWorkflow } from "@medusajs/medusa/core-flows";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params;
  const { status } = req.body as { status: "Processing" | "Delivered" };

  const query = req.scope.resolve("query");

  try {
    // 1. Fetch order details
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.id",
        "payment_collections.payments.id",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
        "items.id",
        "items.quantity",
        "shipping_address.id",
      ],
      filters: { id },
    });

    const order = orders[0];
    if (!order) {
      return res.status(404).json({ message: `Order with ID ${id} not found.` });
    }

    if (status === "Processing") {
      // Find the uncaptured payment
      const paymentCollection = order.payment_collections?.[0];
      const payment = paymentCollection?.payments?.[0];

      if (!payment) {
        return res.status(400).json({ message: "No payment record found for this order." });
      }

      if (payment.captured_at) {
        return res.status(400).json({ message: "Payment already captured." });
      }

      // Execute capture payment workflow
      await capturePaymentWorkflow(req.scope).run({
        input: {
          payment_id: payment.id,
          amount: payment.amount,
        },
      });

      return res.json({ success: true, status: "Processing" });
    }

    if (status === "Delivered") {
      // 1. Create fulfillment
      const items = order.items?.map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
      })) || [];

      if (items.length === 0) {
        return res.status(400).json({ message: "No items in this order to fulfill." });
      }

      // Create fulfillment workflow
      const fulfillmentResult = await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: id,
          items,
        },
      });

      const fulfillment = fulfillmentResult.result;

      // 2. Create shipment to mark as delivered/completed
      await createShipmentWorkflow(req.scope).run({
        input: {
          id: fulfillment.id,
          labels: [],
        },
      });

      return res.json({ success: true, status: "Delivered" });
    }

    res.status(400).json({ message: `Unsupported status transition: ${status}` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred updating order status." });
  }
}
