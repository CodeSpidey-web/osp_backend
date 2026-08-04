import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const taxService = req.scope.resolve("tax") as any
  const db = req.scope.resolve("__pg_connection__") as any

  try {
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "name", "metadata"],
    })
    const store = stores[0]

    let taxRegions = await taxService.listTaxRegions({ country_code: "in" }, { relations: ["tax_rates"] })
    const defaultRateObj = taxRegions[0]?.tax_rates?.find((r: any) => r.is_default)
    const taxRate = defaultRateObj ? defaultRateObj.rate : 18

    const isTaxInclusiveRes = await db.raw(
      "SELECT is_tax_inclusive FROM price_preference WHERE attribute = 'currency_code' AND value = 'inr'"
    )
    const isTaxInclusive = isTaxInclusiveRes.rows[0]?.is_tax_inclusive ?? false

    res.json({
      logo_url: store.metadata?.logo_url || "",
      phone: store.metadata?.phone || "",
      email: store.metadata?.email || "",
      flat_shipping_rate: store.metadata?.flat_shipping_rate !== undefined ? Number(store.metadata?.flat_shipping_rate) : 70,
      shipping_gst: store.metadata?.shipping_gst !== undefined ? Number(store.metadata?.shipping_gst) : 18,
      free_shipping_threshold: store.metadata?.free_shipping_threshold !== undefined ? Number(store.metadata?.free_shipping_threshold) : 999,
      is_tax_inclusive: isTaxInclusive,
      tax_rate: taxRate
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving client settings" })
  }
}
