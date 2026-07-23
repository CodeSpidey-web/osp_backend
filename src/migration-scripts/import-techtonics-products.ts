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

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

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

interface ProductEntry {
  productName: string
  price: number
  stockStatus: string
  url: string
  categories: string[]
}

async function findExisting(query: any, entity: string, fields: string[]) {
  const result = await query.graph({ entity, fields })
  return result.data
}

export default async function importTechtonicsProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("Starting Techtonics product import...")

  // 1. Read CSV
  const possiblePaths = [
    path.join(process.cwd(), "techtonics_products.csv"),
    path.join(process.cwd(), "..", "techtonics_products.csv"),
    path.join(process.cwd(), "..", "..", "techtonics_products.csv"),
  ]
  let csvPath = ""
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      csvPath = p
      break
    }
  }
  if (!csvPath) {
    logger.error("Could not find techtonics_products.csv. Tried: " + possiblePaths.join(", "))
    return
  }
  logger.info(`Reading CSV from: ${csvPath}`)

  const csvContent = fs.readFileSync(csvPath, "utf-8")
  const lines = csvContent.split("\n")
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0)

  // 2. Parse and deduplicate by URL
  const productMap = new Map<string, ProductEntry>()
  for (const line of dataLines) {
    const fields = parseCSVLine(line)
    if (fields.length < 6) continue
    const [categoryName, , productName, priceStr, stockStatus, url] = fields
    const price = parsePrice(priceStr)
    const existing = productMap.get(url)
    if (existing) {
      if (!existing.categories.includes(categoryName)) {
        existing.categories.push(categoryName)
      }
    } else {
      productMap.set(url, {
        productName,
        price,
        stockStatus: stockStatus.trim(),
        url,
        categories: [categoryName],
      })
    }
  }
  logger.info(`Parsed ${productMap.size} unique products from CSV`)

  // 3. Look up existing categories (case-insensitive match)
  const categories = await findExisting(query, "product_category", [
    "id",
    "name",
    "handle",
    "parent_category_id",
  ])
  const categoryByName: Record<string, any> = {}
  for (const cat of categories) {
    categoryByName[cat.name.toLowerCase().trim()] = cat
  }
  logger.info(`Found ${categories.length} existing categories in DB`)

  // Log which categories from CSV exist vs. missing
  const allCsvCategoryNames = new Set<string>()
  for (const [, entry] of productMap) {
    for (const cat of entry.categories) {
      allCsvCategoryNames.add(cat)
    }
  }
  const missingCategories: string[] = []
  for (const catName of allCsvCategoryNames) {
    if (!categoryByName[catName.toLowerCase().trim()]) {
      missingCategories.push(catName)
    }
  }
  if (missingCategories.length > 0) {
    logger.warn(
      `The following CSV categories were NOT found in the database. Products in these will be skipped:\n  - ${missingCategories.join("\n  - ")}`
    )
  }

  // 4. Find or create a "Specification" product option
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

  // 5. Find existing entities needed for product creation
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

  // 6. Build products array
  const productsToCreate: any[] = []
  const usedHandles = new Set<string>()

  for (const [, entry] of productMap) {
    // Resolve category IDs
    const categoryIds: string[] = []
    for (const catName of entry.categories) {
      const cat = categoryByName[catName.toLowerCase().trim()]
      if (cat) {
        categoryIds.push(cat.id)
      }
    }
    if (categoryIds.length === 0) {
      logger.warn(
        `Skipping "${entry.productName.substring(0, 60)}..." - no matching category`
      )
      continue
    }

    // Generate unique handle
    let baseHandle = generateHandle(entry.productName)
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

    const sku = "TEC_" + handle.toUpperCase().replace(/-/g, "_")

    if (existingSkus.has(sku)) {
      logger.info(`Skipping "${entry.productName.substring(0, 60)}..." - SKU already exists (${sku})`)
      continue
    }

    productsToCreate.push({
      title: entry.productName,
      handle,
      category_ids: categoryIds,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      options: [{ id: productOption.id }],
      variants: [
        {
          title: "Standard",
          sku,
          manage_inventory: true,
          allow_backorder: entry.stockStatus !== "In Stock",
          options: { Specification: "Standard" },
          prices: [{ amount: entry.price, currency_code: "inr" }],
        },
      ],
      sales_channels: [{ id: defaultSalesChannel.id }],
    })
  }

  if (productsToCreate.length === 0) {
    logger.info("No products to create.")
    return
  }

  // 7. Create products in batches
  const batchSize = 25
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

  // 8. Set inventory levels
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
