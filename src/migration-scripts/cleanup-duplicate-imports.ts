import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"

async function findExisting(query: any, entity: string, fields: string[]) {
  const result = await query.graph({ entity, fields })
  return result.data
}

export default async function cleanupDuplicateImports({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  )

  // Find all variants with old-style SKUs (no TEC_ prefix)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "product_id"],
  })

  const oldVariants = variants.filter(
    (v: any) =>
      v.sku &&
      !v.sku.startsWith("TEC_") &&
      v.sku !== "RPI4-4GB-1PK" &&
      v.sku !== "RPI4-8GB-1PK" &&
      v.sku !== "ARD-KIT-1PK" &&
      v.sku !== "ARD-UNO-1PK" &&
      v.sku !== "ARD-UNO-3PK" &&
      v.sku !== "SNS-HCSR04-1PK" &&
      v.sku !== "SNS-HCSR04-3PK" &&
      v.sku !== "ESP32-MCU-1PK" &&
      v.sku !== "ESP32-MCU-3PK" &&
      v.sku !== "BREADBOARD-SET-1PK"
  )

  if (oldVariants.length === 0) {
    logger.info("No old-format products found to clean up.")
    return
  }

  // Get unique product IDs
  const productIds = [...new Set(oldVariants.map((v: any) => v.product_id))]
  logger.info(
    `Found ${productIds.length} products with old SKU format. Deleting...`
  )

  // Delete products
  for (const id of productIds) {
    try {
      await productModuleService.softDeleteProducts([id])
    } catch (e: any) {
      logger.error(`Error deleting product ${id}: ${e.message}`)
    }
  }

  logger.info(`Deleted ${productIds.length} duplicate products from first run.`)
}
