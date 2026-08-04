import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"
import * as fs from "fs"

interface ScrapedCategory {
  order: number
  name: string
  slug: string
  depth: number
  path_slugs: string[]
  parent_path: string | null
  url: string
}

export default async function importScrapedCategories({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)

  logger.info("Starting scraped categories import...")

  const filePath = "X:/CodeSpidey/Client Demos/ecommerce_ocean/public/techtonics_scraper_fixed/techtonics_scraper/output/categories.json"

  if (!fs.existsSync(filePath)) {
    logger.error(`Source file not found at: ${filePath}`)
    return
  }

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const scrapedCategories: ScrapedCategory[] = JSON.parse(fileContent)
  logger.info(`Loaded ${scrapedCategories.length} categories from JSON file.`)

  // Sort by depth ascending to make sure parent categories are created before children
  const sortedCategories = [...scrapedCategories].sort((a, b) => a.depth - b.depth)

  // Map to store path -> medusa category ID mapping
  // Path is constructed by joining path_slugs with '/'
  const pathIdMap = new Map<string, string>()

  let createdCount = 0

  for (const cat of sortedCategories) {
    const pathKey = cat.path_slugs.join("/")
    
    // Determine parent ID if depth > 0
    let parentCategoryId: string | null = null
    if (cat.depth > 0 && cat.parent_path) {
      parentCategoryId = pathIdMap.get(cat.parent_path) || null
      if (!parentCategoryId) {
        logger.warn(`Parent category not found in map for parent path: ${cat.parent_path}`)
      }
    }

    try {
      // Create the category
      const [created] = await productModuleService.createProductCategories([
        {
          name: cat.name,
          handle: cat.slug,
          parent_category_id: parentCategoryId,
          is_active: true,
          is_internal: false
        }
      ])

      // Store in map
      pathIdMap.set(pathKey, created.id)
      createdCount++
    } catch (e: any) {
      logger.error(`Failed to create category ${cat.name} (handle: ${cat.slug}): ${e.message}`)
    }
  }

  logger.info(`Successfully created ${createdCount} of ${scrapedCategories.length} categories!`)
}
