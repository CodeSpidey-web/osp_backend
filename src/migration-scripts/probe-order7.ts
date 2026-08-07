import { getOrderDetailWorkflow } from "@medusajs/core-flows";

export default async function probe({ container }: any) {
  const w = getOrderDetailWorkflow(container);
  const { result: order } = await w.run({
    input: {
      fields: [
        "id", "display_id", "currency_code", "email",
        "total", "subtotal", "tax_total", "discount_total",
        "original_total", "original_subtotal", "original_tax_total",
        "item_total", "item_subtotal", "item_tax_total",
        "original_item_total", "original_item_subtotal", "original_item_tax_total",
        "shipping_total", "shipping_subtotal", "shipping_tax_total",
        "original_shipping_tax_total", "original_shipping_subtotal", "original_shipping_total",
        "*items", "*items.tax_lines", "*items.adjustments", "*items.detail",
        "*shipping_methods", "*shipping_methods.tax_lines", "*shipping_methods.adjustments"
      ],
      order_id: "order_01KZ931464DQ94BRTZ",
      filters: {}
    }
  });
  console.log("TOTALS:", JSON.stringify({
    total: order.total, subtotal: order.subtotal, tax_total: order.tax_total,
    original_total: order.original_total, original_subtotal: order.original_subtotal, original_tax_total: order.original_tax_total,
    item_total: order.item_total, item_subtotal: order.item_subtotal, item_tax_total: order.item_tax_total,
    original_item_total: order.original_item_total, original_item_tax_total: order.original_item_tax_total,
    shipping_total: order.shipping_total, shipping_subtotal: order.shipping_subtotal, shipping_tax_total: order.shipping_tax_total,
    original_shipping_total: order.original_shipping_total, original_shipping_tax_total: order.original_shipping_tax_total
  }, null, 2));
  console.log("ITEMS:", JSON.stringify(order.items?.map((i: any) => ({
    title: i.title, qty: i.detail?.quantity ?? i.quantity, unit_price: i.unit_price, total: i.total, subtotal: i.subtotal,
    item_tax: i.tax_lines?.map((t: any) => ({ code: t.code, rate: t.rate, subtotal: t.subtotal, total: t.total }))
  })), null, 2));
  console.log("SHIP:", JSON.stringify(order.shipping_methods?.map((m: any) => ({
    name: m.name, amount: m.amount, subtotal: m.subtotal,
    tax: m.tax_lines?.map((t: any) => ({ code: t.code, rate: t.rate, subtotal: t.subtotal, total: t.total }))
  })), null, 2));
  console.log("SUMMARY:", JSON.stringify((order.summary as any)?.totals ?? order.summary));
}