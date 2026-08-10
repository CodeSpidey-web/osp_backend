import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { variant_ids } = req.query as { variant_ids?: string }

  if (!variant_ids) {
    return res.status(400).json({ message: "Missing variant_ids" })
  }

  const ids = variant_ids.split(",").map((s) => s.trim()).filter(Boolean)

  if (ids.length === 0) {
    return res.json({ variants: {} })
  }

  const db = req.scope.resolve("__pg_connection__") as any

  try {
    const result = await db.raw(
      `SELECT 
        pv.id AS variant_id,
        pvii.inventory_item_id,
        COALESCE(il.stocked_quantity, 0) AS quantity
       FROM product_variant pv
       LEFT JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
       LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
       WHERE pv.id = ANY($1) AND pv.deleted_at IS NULL`,
      [ids]
    )

    const variants: Record<string, { inventory_item_id: string | null; quantity: number }> = {}
    const seen = new Set<string>()

    for (const row of result.rows || []) {
      if (seen.has(row.variant_id)) continue
      seen.add(row.variant_id)
      variants[row.variant_id] = {
        inventory_item_id: row.inventory_item_id || null,
        quantity: Number(row.quantity) || 0,
      }
    }

    res.json({ variants })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred fetching variant stock" })
  }
}