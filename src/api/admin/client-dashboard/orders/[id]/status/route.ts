import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { capturePaymentWorkflow, createOrderFulfillmentWorkflow, createShipmentWorkflow } from "@medusajs/medusa/core-flows";
import { sendMail } from "../../../../../../utils/mail";
import { escapeHtml, getCourierOption } from "../../../../../../utils/courierTracking";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params;
  const { status, courierName, trackingNumber } = req.body as {
    status: "Processing" | "Delivered";
    courierName?: string;
    trackingNumber?: string;
  };

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
        "items.*",
        "items.detail.*",
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
      // Capture courier + tracking number (AWB) provided by the admin. The AWB is
      // issued by the courier at booking time and simply recorded here — no shipment
      // API integration is used and no tracking link is attached. The shipped email
      // confirms the dispatch and includes the courier name + AWB for reference.
      const courierNameValue = (courierName || "").trim();
      const trackingNumberValue = (trackingNumber || "").trim();
      const courierDisplayName = getCourierOption(courierNameValue)?.name || courierNameValue;

      const labels = trackingNumberValue
        ? [{ tracking_number: trackingNumberValue, tracking_url: "#", label_url: "" }]
        : [];

      // 1. Create fulfillment
      const items = order.items?.map((item: any) => ({
        id: item.id,
        quantity: item.detail?.quantity ?? item.quantity,
      })) || [];

      if (items.length === 0) {
        return res.status(400).json({ message: "No items in this order to fulfill." });
      }

      // Create fulfillment workflow (stores courier name in fulfillment metadata)
      const fulfillmentResult = await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: id,
          items,
          metadata: courierDisplayName ? { courier_name: courierDisplayName } : undefined,
        },
      });

      const fulfillment = fulfillmentResult.result;

      // 2. Create shipment to mark as shipped/completed
      await createShipmentWorkflow(req.scope).run({
        input: {
          id: fulfillment.id,
          labels,
        },
      });

      // 3. GUARANTEED: Send shipment confirmation email directly from this route
      try {
        console.log(`[Admin Status Route] Preparing shipment email for Order ID: ${id}`);

        // Fetch full order details with all fields needed for email
        const { data: fullOrders } = await query.graph({
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
          filters: { id },
        });

        const fullOrder = fullOrders[0];
        if (fullOrder && fullOrder.email) {
          const firstName = fullOrder.shipping_address?.first_name || "Customer";
          const displayId = fullOrder.display_id || fullOrder.id.substring(0, 10);
          const currency = fullOrder.currency_code?.toUpperCase() || "INR";

          const itemsListHtml = (fullOrder.items || [])
            .map((item: any) => `
              <tr style="border-bottom: 1px solid #f1f3f5;">
                <td style="padding: 10px 0; color: #2d3748;">${item.title}</td>
                <td style="padding: 10px 0; text-align: center; color: #718096;">${item.detail?.quantity ?? item.quantity ?? 1}</td>
                <td style="padding: 10px 0; text-align: right; color: #2d3748;">${currency} ${((item.unit_price ?? 0) * (item.detail?.quantity ?? item.quantity ?? 1)).toFixed(2)}</td>
              </tr>
            `).join("") || "<tr><td colspan='3' style='padding:10px;text-align:center;color:#718096;'>No items listed</td></tr>";

          const shippingAddrParts: string[] = [];
          if (fullOrder.shipping_address) {
            const sa: any = fullOrder.shipping_address;
            if (sa.address_1) shippingAddrParts.push(sa.address_1);
            if (sa.address_2) shippingAddrParts.push(sa.address_2);
            if (sa.city) shippingAddrParts.push(sa.city);
            if (sa.province) shippingAddrParts.push(sa.province);
            if (sa.postal_code) shippingAddrParts.push(sa.postal_code);
          }
          const shippingAddressText = shippingAddrParts.length > 0
            ? shippingAddrParts.join(", ")
            : "Will be delivered to the registered address.";

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
                <p style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px;">
                  <strong>📦 Shipment Details</strong>
                </p>
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Order ID:</strong>
                  #${displayId}
                </p>
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Shipped On:</strong>
                  ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
                ${courierNameValue ? `
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Courier:</strong>
                  ${escapeHtml(courierDisplayName)}
                </p>
                ` : ""}
                ${trackingNumberValue ? `
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Tracking No:</strong>
                  ${escapeHtml(trackingNumberValue)}
                </p>
                ` : ""}
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Delivery To:</strong>
                  ${shippingAddressText}
                </p>
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Est. Delivery:</strong>
                  Within 3-5 business days
                </p>
                ${fullOrder.shipping_address?.phone ? `
                <p style="margin: 6px 0; color: #4a5568; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #0b2545; display: inline-block; min-width: 110px;">Contact:</strong>
                  ${fullOrder.shipping_address.phone}
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
                  💡 <strong style="color: #9a3412;">Tip:</strong>
                  Please keep your phone handy near the delivery date — the courier partner may call you before attempting delivery.
                  Expect a confirmation call on ${fullOrder.shipping_address?.phone || "your registered number"}.
                </p>
              </div>

              <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-top: 24px;">
                Thank you for choosing Ocean Student Projects! 🙏<br/>
                We hope you enjoy your purchase. Share your experience with us — we love hearing from students.
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
          `;

          const emailSubject = `🚚 Shipped! Your Ocean Student Projects Order #${displayId} is on the way`;

          await sendMail({
            to: fullOrder.email,
            subject: emailSubject,
            html: emailHtml,
          });

          console.log(`[Admin Status Route] ✅ Shipment email sent successfully to ${fullOrder.email} for Order #${displayId}`);
        } else {
          console.warn(`[Admin Status Route] ⚠️ Could not send shipment email — order or customer email missing for Order ID: ${id}`);
        }
      } catch (emailErr: any) {
        console.error("[Admin Status Route] ❌ ERROR sending shipment email:", emailErr?.message || emailErr);
        // Non-blocking: order status update was already successful
      }

      return res.json({ success: true, status: "Delivered" });
    }

    res.status(400).json({ message: `Unsupported status transition: ${status}` });
  } catch (error: any) {
    console.error("[Status Route Error]", error);
    res.status(500).json({ message: error.message || "An error occurred updating order status." });
  }
}
