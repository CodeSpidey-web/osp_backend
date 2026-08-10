import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { createLinksWorkflow } from "@medusajs/core-flows";
import { getDb } from "../db";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { inventory_item_id, variant_id, quantity } = req.body as {
    inventory_item_id: string
    variant_id: string
    quantity: number
  }

  if (!variant_id && !inventory_item_id) {
    return res.status(400).json({ message: "Missing variant_id or inventory_item_id" })
  }

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({ message: "Missing quantity" })
  }

  const query = req.scope.resolve("query")
  const inventoryModuleService = req.scope.resolve("inventory") as any

  try {
    let resolvedItemId: string | null = inventory_item_id || null

    if (!resolvedItemId && variant_id) {
      // Resolve existing inventory item linked to the variant
      const { data: links } = await query.graph({
        entity: "product_variant_inventory_item",
        fields: ["inventory_item_id"],
        filters: { variant_id },
      })
      resolvedItemId = links[0]?.inventory_item_id || null

      // If the variant has no inventory item yet, create one and link it
      if (!resolvedItemId) {
        const { data: variants } = await query.graph({
          entity: "product_variant",
          fields: ["sku"],
          filters: { id: variant_id },
        })
        const sku = variants[0]?.sku || null

        const created = await inventoryModuleService.createInventoryItems([{ sku }])
        resolvedItemId = created[0]?.id || null

        if (!resolvedItemId) {
          throw new Error("Failed to create inventory item")
        }

        await createLinksWorkflow(req.scope).run({
          input: [
            {
              [Modules.PRODUCT]: { variant_id },
              [Modules.INVENTORY]: { inventory_item_id: resolvedItemId },
            },
          ],
        })
      }
    }

    if (!resolvedItemId) {
      return res.status(400).json({ message: "Could not determine inventory item for the variant" })
    }

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
      inventory_item_id: [resolvedItemId],
      location_id: [location_id],
    })

    const oldQuantity = levels[0]?.stocked_quantity || 0
    const changeAmount = quantity - oldQuantity

    if (levels.length === 0) {
      // Create a new location level if it does not exist
      await inventoryModuleService.createInventoryLevels([
        {
          inventory_item_id: resolvedItemId,
          location_id,
          stocked_quantity: quantity,
        },
      ])
    } else {
      // Update existing level
      await inventoryModuleService.updateInventoryLevels({
        inventory_item_id: resolvedItemId,
        location_id,
        stocked_quantity: quantity,
      })
    }

    // 3. Resolve variant details and log to history if there is any change
    const effectiveVariantId = variant_id || null
    if (changeAmount !== 0) {
      try {
        let sku = "Unknown SKU"
        let product_title = "Unknown Product"
        let resolvedVariantId = effectiveVariantId

        if (!resolvedVariantId) {
          const { data: links } = await query.graph({
            entity: "product_variant_inventory_item",
            fields: ["variant_id"],
            filters: { inventory_item_id: resolvedItemId },
          })
          resolvedVariantId = links[0]?.variant_id || null
        }

        if (resolvedVariantId) {
          const { data: variants } = await query.graph({
            entity: "product_variant",
            fields: ["sku", "product.title"],
            filters: { id: resolvedVariantId },
          })
          sku = variants[0]?.sku || "Unknown SKU"
          product_title = variants[0]?.product?.title || "Unknown Product"
        }

        const db = await getDb(req)
        const updated_by = (req as any).auth_context?.actor_id || "Admin"

        await db("inventory_history").insert({
          inventory_item_id: resolvedItemId,
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

    res.json({ success: true, inventory_item_id: resolvedItemId, quantity })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred updating inventory level" })
  }
}