import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { capturePaymentWorkflow, createOrderFulfillmentWorkflow, createShipmentWorkflow } from "@medusajs/medusa/core-flows";
import { sendMail } from "../../../../../../utils/mail";
import { escapeHtml, getCourierOption } from "../../../../../../utils/courierTracking";
import {
  BRAND,
  renderBrandedEmail,
  renderButton,
  renderSummaryCard,
  renderOrderItemsTable,
  getStorefrontUrl,
  OrderItemRow,
} from "../../../../../../utils/emailLayout";

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
      const paymentCollection = order.payment_collections?.[0];
      const payment = paymentCollection?.payments?.[0];

      if (!payment) {
        return res.status(400).json({ message: "No payment record found for this order." });
      }

      if (payment.captured_at) {
        return res.status(400).json({ message: "Payment already captured." });
      }

      await capturePaymentWorkflow(req.scope).run({
        input: {
          payment_id: payment.id,
          amount: payment.amount,
        },
      });

      return res.json({ success: true, status: "Processing" });
    }

    if (status === "Delivered") {
      const courierNameValue = (courierName || "").trim();
      const trackingNumberValue = (trackingNumber || "").trim();
      const courierDisplayName = getCourierOption(courierNameValue)?.name || courierNameValue;

      const labels = trackingNumberValue
        ? [{ tracking_number: trackingNumberValue, tracking_url: "#", label_url: "" }]
        : [];

      const items = order.items?.map((item: any) => ({
        id: item.id,
        quantity: item.detail?.quantity ?? item.quantity,
      })) || [];

      if (items.length === 0) {
        return res.status(400).json({ message: "No items in this order to fulfill." });
      }

      const fulfillmentResult = await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: id,
          items,
          metadata: courierDisplayName ? { courier_name: courierDisplayName } : undefined,
        },
      });

      const fulfillment = fulfillmentResult.result;

      await createShipmentWorkflow(req.scope).run({
        input: {
          id: fulfillment.id,
          labels,
        },
      });

      try {
        console.log(`[Admin Status Route] Preparing shipment email for Order ID: ${id}`);

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
          const firstName = escapeHtml(fullOrder.shipping_address?.first_name || "Customer");
          const displayId = escapeHtml(String(fullOrder.display_id || fullOrder.id.substring(0, 10)));
          const currency = fullOrder.currency_code?.toUpperCase() || "INR";

          const itemRows: OrderItemRow[] = (fullOrder.items || [])
            .map((item: any) => {
              const qty = item.detail?.quantity ?? item.quantity ?? 1;
              const lineTotal = (item.unit_price ?? 0) * qty;
              return {
                title: item.title,
                quantity: qty,
                amount: `${currency} ${Number(lineTotal).toFixed(2)}`,
              };
            });

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
            ? escapeHtml(shippingAddrParts.join(", "))
            : "Will be delivered to the registered address.";

          const summaryRows: Array<[string, string]> = [
            ["Order ID", `<strong style="color: ${BRAND.colors.green};">#${displayId}</strong>`],
            ["Shipped On", new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
          ];
          if (courierNameValue) {
            summaryRows.push(["Courier", escapeHtml(courierDisplayName)]);
          }
          if (trackingNumberValue) {
            summaryRows.push(["Tracking No", escapeHtml(trackingNumberValue)]);
          }
          summaryRows.push(["Delivery To", shippingAddressText]);
          summaryRows.push(["Est. Delivery", "Within 3-5 business days"]);
          if (fullOrder.shipping_address?.phone) {
            summaryRows.push(["Contact", escapeHtml(fullOrder.shipping_address.phone)]);
          }

          const contactPhoneHtml = fullOrder.shipping_address?.phone
            ? `<strong>${escapeHtml(fullOrder.shipping_address.phone)}</strong>`
            : "your registered number";

          const profileHref = `${getStorefrontUrl()}/profile`;

          const body = `
            <p style="color: ${BRAND.colors.textPrimary}; font-size: 15px; line-height: 1.65; margin: 0 0 10px 0;">
              Dear ${firstName},
            </p>
            <p style="color: ${BRAND.colors.textBody}; font-size: 15px; line-height: 1.65; margin: 0 0 6px 0;">
              We are pleased to inform you that your order <strong style="color: ${BRAND.colors.green};">#${displayId}</strong> has been
              shipped and is on the way to your delivery address.
            </p>

            ${renderSummaryCard("Shipment Details", summaryRows, "📦")}

            <h4 style="color: ${BRAND.colors.textPrimary}; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
              Your Shipment Contains
            </h4>
            ${renderOrderItemsTable(itemRows)}

            <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid ${BRAND.colors.orange}; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.55;">
                💡 <strong style="color: #9a3412;">Tip:</strong><br/>
                Please keep your phone handy near the delivery date — the courier partner may call you before attempting delivery.
                Expect a confirmation call on ${contactPhoneHtml}.
              </p>
            </div>

            <div style="text-align: center;">
              ${renderButton({ label: "Track Order in Profile", href: profileHref, variant: "primary" })}
            </div>

            <p style="color: ${BRAND.colors.textBody}; font-size: 14px; line-height: 1.65; margin: 24px 0 0 0;">
              Thank you for choosing <strong style="color: ${BRAND.colors.green};">${escapeHtml(BRAND.name)}</strong>! 🙏<br/>
              We hope you enjoy your purchase. Share your experience with us — we love hearing from students.
            </p>

            <p style="color: ${BRAND.colors.textMuted}; font-size: 13px; line-height: 1.6; text-align: center; margin: 28px 0 0 0;">
              For any delivery queries, reply to this email or reach our support team.<br/>
              <strong style="color: ${BRAND.colors.green};">Happy building! 💚</strong>
            </p>
          `;

          const emailHtml = renderBrandedEmail({
            previewText: `Order #${displayId} is on its way 🚚`,
            heroEmoji: "🚚",
            heroHeading: "Your Order Has Shipped!",
            heroSubheading: `Great news, ${fullOrder.shipping_address?.first_name || "Customer"}! Your package is on its way 🎉`,
            body,
          });

          const emailSubject = `🚚 Shipped! Your ${BRAND.name} Order #${displayId} is on the way`;

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
      }

      return res.json({ success: true, status: "Delivered" });
    }

    res.status(400).json({ message: `Unsupported status transition: ${status}` });
  } catch (error: any) {
    console.error("[Status Route Error]", error);
    res.status(500).json({ message: error.message || "An error occurred updating order status." });
  }
}
