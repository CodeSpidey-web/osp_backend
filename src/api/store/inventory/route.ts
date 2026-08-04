import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const variantIdsParam = req.query.variant_ids as string;
  if (!variantIdsParam) {
    return res.json({ inventory: {} });
  }

  const variantIds = variantIdsParam.split(",");
  const db = req.scope.resolve("__pg_connection__") as any;

  try {
    const queryResult = await db.raw(`
      SELECT 
        pvii.variant_id,
        COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)::integer as inventory_quantity
      FROM product_variant_inventory_item pvii
      JOIN inventory_level il ON pvii.inventory_item_id = il.inventory_item_id
      WHERE pvii.variant_id = ANY(?)
      GROUP BY pvii.variant_id
    `, [variantIds]);

    const inventoryMap: Record<string, number> = {};
    // Pre-populate with 0 for requested ids
    variantIds.forEach(id => {
      inventoryMap[id] = 0;
    });

    if (queryResult && queryResult.rows) {
      for (const row of queryResult.rows) {
        inventoryMap[row.variant_id] = row.inventory_quantity;
      }
    }

    // Check if variant doesn't manage inventory. If manage_inventory is false, it's always in stock!
    const manageInvResult = await db.raw(`
      SELECT id, manage_inventory 
      FROM product_variant 
      WHERE id = ANY(?)
    `, [variantIds]);

    if (manageInvResult && manageInvResult.rows) {
      for (const row of manageInvResult.rows) {
        if (row.manage_inventory === false) {
          inventoryMap[row.id] = 9999; // Infinite inventory
        }
      }
    }

    return res.json({ inventory: inventoryMap });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
