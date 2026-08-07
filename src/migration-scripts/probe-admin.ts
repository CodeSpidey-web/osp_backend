import { getOrderDetailWorkflow } from "@medusajs/core-flows";

export default async function probe({ container }: any) {
  const w = getOrderDetailWorkflow(container);
  const { result: order } = await w.run({
    input: {
      fields: [
        "id", "display_id", "custom_display_id", "status", "version", "summary",
        "region_id", "total", "subtotal", "tax_total", "discount_total", "discount_tax_total",
        "original_total", "original_subtotal", "original_tax_total",
        "item_total", "item_subtotal", "item_tax_total",
        "original_item_total", "original_item_subtotal", "original_item_tax_total",
        "shipping_total", "shipping_subtotal", "shipping_tax_total",
        "original_shipping_tax_total", "original_shipping_subtotal", "original_shipping_total",
        "credit_line_total", "credit_line_subtotal", "credit_line_tax_total",
        "*items", "*items.tax_lines", "*items.adjustments", "*items.variant",
        "*items.variant.product", "*items.detail",
        "*shipping_address", "*billing_address",
        "*shipping_methods", "*shipping_methods.tax_lines", "*shipping_methods.adjustments",
        "*payment_collections", "*payment_collections.payments"
      ],
      order_id: "order_01KZ8YXM6A61EPVVCCTKHJ6E75",
      filters: {}
    }
  });
  console.log("TOTALS:", JSON.stringify({
    total: order.total, subtotal: order.subtotal, tax_total: order.tax_total,
    item_total: order.item_total, item_subtotal: order.item_subtotal, item_tax_total: order.item_tax_total,
    shipping_total: order.shipping_total, shipping_subtotal: order.shipping_subtotal, shipping_tax_total: order.shipping_tax_total
  }, null, 2));
  console.log("ITEMS:", JSON.stringify(order.items?.map((i: any) => ({
    title: i.title, qty: i.quantity, unit_price: i.unit_price, total: i.total,
    detail_unit: i.detail?.unit_price, detail_qty: i.detail?.quantity,
    item_total: i.detail?.total, item_subtotal: i.detail?.subtotal
  })), null, 2));
  console.log("SHIP:", JSON.stringify(order.shipping_methods?.map((m: any) => ({
    name: m.name, amount: m.amount, subtotal: m.subtotal
  })), null, 2));
  console.log("SUMMARY:", JSON.stringify(order.summary));
}