import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDb } from "../db";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { inventory_item_id, quantity } = req.body as {
    inventory_item_id: string
    quantity: number
  }

  if (!inventory_item_id || quantity === undefined || quantity === null) {
    return res.status(400).json({ message: "Missing inventory_item_id or quantity" })
  }

  const query = req.scope.resolve("query")
  const inventoryModuleService = req.scope.resolve("inventory") as any

  try {
    // 1. Get default stock location
    const { data: locations } = await query.graph({
      entity: "stock_location",
      fields: ["id"],
    })

    if (!locations || locations.length === 0) {
      return res.status(400).json({ message: "No stock location found on backend" })
    }

    const location_id = locations[0].id

    // 2. Query inventory levels to check if association exists
    const levels = await inventoryModuleService.listInventoryLevels({
      inventory_item_id: [inventory_item_id],
      location_id: [location_id],
    })

    const oldQuantity = levels[0]?.stocked_quantity || 0
    const changeAmount = quantity - oldQuantity

    if (levels.length === 0) {
      // Create a new location level if it does not exist
      await inventoryModuleService.createInventoryLevels([
        {
          inventory_item_id,
          location_id,
          stocked_quantity: quantity,
        },
      ])
    } else {
      // Update existing level
      await inventoryModuleService.updateInventoryLevels({
        inventory_item_id,
        location_id,
        stocked_quantity: quantity,
      })
    }

    // 3. Resolve variant details and log to history if there is any change
    if (changeAmount !== 0) {
      try {
        const { data: links } = await query.graph({
          entity: "product_variant_inventory_item",
          fields: ["variant_id"],
          filters: { inventory_item_id }
        })

        const variantId = links[0]?.variant_id
        let sku = "Unknown SKU"
        let product_title = "Unknown Product"

        if (variantId) {
          const { data: variants } = await query.graph({
            entity: "product_variant",
            fields: ["sku", "product.title"],
            filters: { id: variantId }
          })
          sku = variants[0]?.sku || "Unknown SKU"
          product_title = variants[0]?.product?.title || "Unknown Product"
        }

        const db = await getDb(req)
        const updated_by = (req as any).auth_context?.actor_id || "Admin"

        await db("inventory_history").insert({
          inventory_item_id,
          sku,
          product_title,
          change_amount: changeAmount,
          new_quantity: quantity,
          updated_by,
        })
      } catch (logError) {
        console.error("Failed to log inventory history:", logError)
      }
    }

    res.json({ success: true, inventory_item_id, quantity })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred updating inventory level" })
  }
}
