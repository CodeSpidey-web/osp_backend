import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

function parseMetadata(raw: any): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {} } catch { return {} }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw
  return {}
}

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
    const graphMetadata = store?.metadata

    let dbMetadataRaw: any = null
    try {
      const dbStore = await db.raw(
        `SELECT id, metadata FROM store WHERE id = ? LIMIT 1`,
        [store?.id]
      )
      dbMetadataRaw = dbStore?.rows?.[0]?.metadata
      console.log("[client-settings API] DB-RAW metadata:", JSON.stringify(dbMetadataRaw), "| type:", typeof dbMetadataRaw)
    } catch (e: any) {
      console.warn("[client-settings API] DB direct read failed:", e?.message || e)
    }

    const graphMetaParsed = parseMetadata(graphMetadata)
    const dbMetaParsed = parseMetadata(dbMetadataRaw)

    const metadata = { ...graphMetaParsed, ...dbMetaParsed }

    const graphDel = graphMetaParsed.delivery_estimate
    const dbDel = dbMetaParsed.delivery_estimate
    console.log("[client-settings API] graph delivery_estimate:", JSON.stringify(graphDel))
    console.log("[client-settings API] db    delivery_estimate:", JSON.stringify(dbDel))
    if (graphDel !== dbDel) {
      console.warn("[client-settings API] ⚠️ MISMATCH: graph (" + JSON.stringify(graphDel) + ") vs db (" + JSON.stringify(dbDel) + ") — DB value wins via merge.")
    }

    console.log("[client-settings API] chosen metadata keys:", Object.keys(metadata))
    console.log("[client-settings API] final chosen delivery_estimate:", JSON.stringify(metadata.delivery_estimate), "type:", typeof metadata.delivery_estimate)

    let taxRegions = await taxService.listTaxRegions({ country_code: "in" }, { relations: ["tax_rates"] })
    const defaultRateObj = taxRegions[0]?.tax_rates?.find((r: any) => r.is_default)
    const taxRate = defaultRateObj ? defaultRateObj.rate : 18

    const isTaxInclusiveRes = await db.raw(
      "SELECT is_tax_inclusive FROM price_preference WHERE attribute = 'currency_code' AND value = 'INR'"
    )
    const isTaxInclusive = isTaxInclusiveRes.rows[0]?.is_tax_inclusive ?? false

    const shipPriceRes = await db.raw(`
      SELECT p.amount
      FROM price p
      JOIN shipping_option_price_set ps ON ps.price_set_id = p.price_set_id
      JOIN shipping_option so ON so.id = ps.shipping_option_id
      WHERE so.name = 'Standard Shipping' AND LOWER(p.currency_code) = 'inr'
      LIMIT 1
    `)
    const actualShipping = shipPriceRes.rows[0] ? Number(shipPriceRes.rows[0].amount) : null

    const deliveryEstimateRaw = metadata.delivery_estimate
    const deliveryEstimate = (typeof deliveryEstimateRaw === "string" && deliveryEstimateRaw.trim() !== "")
      ? deliveryEstimateRaw
      : "Within 3-5 working days"

    const flatRateFromMeta = metadata.flat_shipping_rate
    const shippingGstFromMeta = metadata.shipping_gst
    const freeShipThresholdFromMeta = metadata.free_shipping_threshold

    const responsePayload = {
      logo_url: typeof metadata.logo_url === "string" ? metadata.logo_url : "",
      phone: typeof metadata.phone === "string" ? metadata.phone : "",
      email: typeof metadata.email === "string" ? metadata.email : "",
      flat_shipping_rate: actualShipping ?? (flatRateFromMeta !== undefined && flatRateFromMeta !== null ? Number(flatRateFromMeta) : 70),
      shipping_gst: shippingGstFromMeta !== undefined && shippingGstFromMeta !== null ? Number(shippingGstFromMeta) : 18,
      free_shipping_threshold: freeShipThresholdFromMeta !== undefined && freeShipThresholdFromMeta !== null ? Number(freeShipThresholdFromMeta) : 999,
      delivery_estimate: deliveryEstimate,
      is_tax_inclusive: isTaxInclusive,
      tax_rate: taxRate
    }

    console.log("[client-settings API] final response delivery_estimate:", responsePayload.delivery_estimate, "type:", typeof responsePayload.delivery_estimate)
    console.log("[client-settings API] full response:", JSON.stringify(responsePayload))

    res.json(responsePayload)
  } catch (error: any) {
    console.error("[client-settings API] ERROR:", error)
    res.status(500).json({ message: error.message || "An error occurred retrieving client settings" })
  }
}
