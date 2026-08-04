import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createProductOptionsWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"

function parsePrice(priceStr: string): number {
  const cleaned = priceStr
    .replace(/₹/g, "")
    .replace(/\(incl\.?\s*GST\)/g, "")
    .replace(/,/g, "")
    .trim()
  const amount = parseFloat(cleaned)
  if (isNaN(amount)) return 0
  return Math.round(amount * 100)
}

function generateHandle(name: string): string {
  let handle = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100)
    .replace(/-+$/g, "")
  if (!handle || /[^a-z0-9-]/.test(handle)) {
    handle = "product-" + Math.random().toString(36).substring(2, 8)
  }
  return handle
}

async function findExisting(query: any, entity: string, fields: string[]) {
  const result = await query.graph({ entity, fields })
  return result.data
}

interface ScrapedProduct {
  name: string
  sku: string
  price_text: string
  stock: string
  categories: {
    name: string
    url: string
    path_slugs: string[]
  }[]
  found_in_categories?: any[]
  short_description_html?: string
  description_html: string
  images: string[]
  source_url: string
  local_images?: string[]
}

export default async function importTechtonicsProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)

  logger.info("Starting Techtonics JSON product import...")

  const filePath = "X:/CodeSpidey/Client Demos/ecommerce_ocean/public/techtonics_scraper_fixed/techtonics_scraper/output/products.json"

  if (!fs.existsSync(filePath)) {
    logger.error(`Source file not found at: ${filePath}`)
    return
  }

  logger.info(`Reading products JSON from: ${filePath}`)
  const fileContent = fs.readFileSync(filePath, "utf-8")
  const scrapedProducts: ScrapedProduct[] = JSON.parse(fileContent)
  logger.info(`Loaded ${scrapedProducts.length} products from JSON file.`)

  // 1. Fetch existing categories and build path key to ID map
  const categories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "handle", "parent_category_id"] }
  )

  const categoriesMap = new Map<string, any>()
  for (const cat of categories) {
    categoriesMap.set(cat.id, cat)
  }

  const buildPathKey = (cat: any): string => {
    const pathList = [cat.handle]
    let parentId = cat.parent_category_id
    while (parentId) {
      const parent = categoriesMap.get(parentId)
      if (parent) {
        pathList.unshift(parent.handle)
        parentId = parent.parent_category_id
      } else {
        break
      }
    }
    return pathList.join("/")
  }

  const categoryPathIdMap = new Map<string, string>()
  for (const cat of categories) {
    const key = buildPathKey(cat)
    categoryPathIdMap.set(key, cat.id)
  }
  logger.info(`Mapped ${categoryPathIdMap.size} database categories.`)

  // 2. Find or create a "Specification" product option
  const existingOptions = await findExisting(query, "product_option", [
    "id",
    "title",
  ])
  let productOption = existingOptions.find(
    (o: any) => o.title === "Specification"
  )
  if (!productOption) {
    logger.info('Creating "Specification" product option...')
    const r = await createProductOptionsWorkflow(container).run({
      input: {
        product_options: [{ title: "Specification", values: ["Standard"] }],
      },
    })
    productOption = r.result[0]
  }

  // 3. Find existing entities needed for product creation
  const [defaultSalesChannel] = await findExisting(query, "sales_channel", [
    "id",
    "name",
  ])
  if (!defaultSalesChannel) {
    logger.error("No sales channel found. Run the seed script first.")
    return
  }

  const [shippingProfile] = await findExisting(query, "shipping_profile", [
    "id",
    "name",
  ])
  if (!shippingProfile) {
    logger.error("No shipping profile found. Run the seed script first.")
    return
  }

  const [stockLocation] = await findExisting(query, "stock_location", [
    "id",
    "name",
  ])

  // Check existing product handles and SKUs to avoid conflicts
  const existingProducts = await findExisting(query, "product", [
    "id",
    "handle",
    "title",
  ])
  const existingHandles = new Set(
    existingProducts.map((p: any) => p.handle)
  )
  const { data: existingVariants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku"],
  })
  const existingSkus = new Set(
    existingVariants.map((v: any) => v.sku).filter(Boolean)
  )
  logger.info(
    `Found ${existingHandles.size} existing products and ${existingSkus.size} existing SKUs`
  )

  // 4. Build products array
  const productsToCreate: any[] = []
  const usedHandles = new Set<string>()

  for (const entry of scrapedProducts) {
    // Resolve category IDs using path slugs
    const categoryIds: string[] = []
    const entryCategories = entry.categories || []
    
    for (const cat of entryCategories) {
      if (cat.path_slugs) {
        const pathKey = cat.path_slugs.join("/")
        const catId = categoryPathIdMap.get(pathKey)
        if (catId && !categoryIds.includes(catId)) {
          categoryIds.push(catId)
        }
      }
    }

    if (categoryIds.length === 0) {
      // Fallback: match by name case-insensitive
      for (const cat of entryCategories) {
        const matchingCat = categories.find(c => c.name?.toLowerCase().trim() === cat.name?.toLowerCase().trim())
        if (matchingCat && !categoryIds.includes(matchingCat.id)) {
          categoryIds.push(matchingCat.id)
        }
      }
    }

    // Generate unique handle
    let baseHandle = generateHandle(entry.name)
    if (!baseHandle) {
      baseHandle = "product"
    }
    let handle = baseHandle
    if (existingHandles.has(handle) || usedHandles.has(handle)) {
      let suffix = 2
      while (
        existingHandles.has(`${handle}-${suffix}`) ||
        usedHandles.has(`${handle}-${suffix}`)
      ) {
        suffix++
      }
      handle = `${baseHandle}-${suffix}`
    }
    usedHandles.add(handle)

    // Standardize SKU
    const sku = entry.sku ? entry.sku.trim() : "TEC_" + handle.toUpperCase().replace(/-/g, "_")

    if (existingSkus.has(sku)) {
      logger.info(`Skipping "${entry.name.substring(0, 60)}..." - SKU already exists (${sku})`)
      continue
    }

    // Process images
    let thumbnail: string | undefined = undefined
    const images: { url: string }[] = []
    
    if (entry.local_images && entry.local_images.length > 0) {
      const normalizedPaths = entry.local_images.map(img => {
        const normalized = '/' + img.replace(/\\/g, '/');
        return normalized;
      })
      
      thumbnail = normalizedPaths[0]
      normalizedPaths.forEach(pathUrl => {
        images.push({ url: pathUrl })
      })
    } else if (entry.images && entry.images.length > 0) {
      thumbnail = entry.images[0]
      entry.images.forEach(imgUrl => {
        images.push({ url: imgUrl })
      })
    }

    const price = parsePrice(entry.price_text)

    productsToCreate.push({
      title: entry.name,
      handle,
      description: entry.description_html || "",
      category_ids: categoryIds,
      thumbnail,
      images,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      options: [{ id: productOption.id }],
      variants: [
        {
          title: "Standard",
          sku,
          manage_inventory: true,
          allow_backorder: entry.stock !== "In stock",
          options: { Specification: "Standard" },
          prices: [{ amount: price, currency_code: "inr" }],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel.id }],
    })
  }

  if (productsToCreate.length === 0) {
    logger.info("No products to create.")
    return
  }

  logger.info(`Batched ${productsToCreate.length} products for database insertion.`)

  // 5. Create products in batches
  const batchSize = 50
  let createdCount = 0
  for (let i = 0; i < productsToCreate.length; i += batchSize) {
    const batch = productsToCreate.slice(i, i + batchSize)
    try {
      await createProductsWorkflow(container).run({
        input: { products: batch },
      })
      createdCount += batch.length
      logger.info(
        `Created products ${i + 1} - ${Math.min(i + batchSize, productsToCreate.length)} (${createdCount}/${productsToCreate.length})`
      )
    } catch (error: any) {
      logger.error(
        `Error creating products batch ${i}-${i + batch.length}: ${error?.message || error}`
      )
    }
  }
  logger.info(`Successfully created ${createdCount} products.`)

  // 6. Set inventory levels
  if (stockLocation) {
    try {
      const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
      })
      
      const inventoryLevels = inventoryItems.map((item: any) => ({
        location_id: stockLocation.id,
        inventory_item_id: item.id,
        stocked_quantity: 100,
      }))
      
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: inventoryLevels },
      })
      logger.info(
        `Set inventory levels for ${inventoryLevels.length} items at ${stockLocation.name}.`
      )
    } catch (error: any) {
      logger.error(`Error setting inventory levels: ${error?.message || error}`)
    }
  } else {
    logger.warn("No stock location found - skipping inventory level setup.")
  }

  logger.info("Techtonics product import completed successfully!")
}
