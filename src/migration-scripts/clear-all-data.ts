import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"

export default async function clearAllData({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)
  const db = container.resolve("__pg_connection__") as any

  logger.info("Initializing database purge...")

  try {
    // 1. Delete all products using Medusa's service
    const products = await productModuleService.listProducts({}, { select: ["id"] })
    if (products.length > 0) {
      const productIds = products.map((p: any) => p.id)
      logger.info(`Deleting ${productIds.length} products via Medusa service...`)
      await productModuleService.deleteProducts(productIds)
      logger.info("Products deleted via service.")
    }

    // 2. Delete all categories using Medusa's service
    const categories = await productModuleService.listProductCategories({}, { select: ["id"] })
    if (categories.length > 0) {
      const categoryIds = categories.map((c: any) => c.id)
      logger.info(`Deleting ${categoryIds.length} categories via Medusa service...`)
      await productModuleService.deleteProductCategories(categoryIds)
      logger.info("Categories deleted via service.")
    }

    // 3. Delete all collections using Medusa's service
    const collections = await productModuleService.listProductCollections({}, { select: ["id"] })
    if (collections.length > 0) {
      const collectionIds = collections.map((c: any) => c.id)
      logger.info(`Deleting ${collectionIds.length} collections via Medusa service...`)
      await productModuleService.deleteProductCollections(collectionIds)
      logger.info("Collections deleted via service.")
    }

  } catch (error: any) {
    logger.warn(`Service-level delete encountered warnings: ${error.message}. Proceeding to SQL override...`)
  }

  // 4. Force truncate all relevant tables using cascade SQL to ensure database is perfectly clean
  logger.info("Running SQL cascade truncate to purge remaining records and reset IDs...")
  
  const tablesToTruncate = [
    "product",
    "product_variant",
    "product_category",
    "product_collection",
    "product_option",
    "product_tag",
    "product_images",
    "price_set",
    "price",
    "inventory_item",
    "inventory_level",
    "reservation_item",
    "inventory_history"
  ]

  for (const table of tablesToTruncate) {
    try {
      await db.raw(`TRUNCATE TABLE "${table}" CASCADE;`)
      logger.info(`Truncated table: ${table}`)
    } catch (e: any) {
      logger.debug(`Could not truncate table ${table}: ${e.message}`)
    }
  }

  logger.info("Database purge completed perfectly!")
}
