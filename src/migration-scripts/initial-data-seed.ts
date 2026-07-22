import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

async function findExisting(query: any, entity: string, fields: string[]) {
  const result = await query.graph({ entity, fields })
  return result.data
}

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["in"];

  logger.info("Checking existing data...");

  // --- Sales Channel ---
  let [defaultSalesChannel] = await findExisting(query, "sales_channel", ["id", "name"])
  if (!defaultSalesChannel) {
    const r = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel", description: "Created by Medusa" }] },
    })
    defaultSalesChannel = r.result[0]
    logger.info("Created sales channel.")
  }

  // --- API Key ---
  let [publishableApiKey] = await findExisting(query, "api_key", ["id", "title"])
  if (!publishableApiKey) {
    const r = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Default Publishable API Key", type: "publishable", created_by: "" }] },
    })
    publishableApiKey = r.result[0]
    logger.info("Created API key.")
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableApiKey.id, add: [defaultSalesChannel.id] },
    })
  }

  // --- Store ---
  let [store] = await findExisting(query, "store", ["id", "name"])
  if (!store) {
    const r = await createStoresWorkflow(container).run({
      input: {
        stores: [{
          name: "Ocean Student Projects",
          supported_currencies: [{ currency_code: "inr", is_default: true }],
          default_sales_channel_id: defaultSalesChannel.id,
        }],
      },
    })
    store = r.result[0]
    logger.info("Created store.")
  }

  // --- Region ---
  let region: any = null
  try {
    const r = await createRegionsWorkflow(container).run({
      input: { regions: [{ name: "India", currency_code: "inr", countries, payment_providers: ["pp_system_default"] }] },
    })
    region = r.result[0]
    logger.info("Created India region with INR.")
    await createTaxRegionsWorkflow(container).run({ input: countries.map((c) => ({ country_code: c, provider_id: "tp_system" })) })
    logger.info("Seeded tax regions.")
  } catch (_e) {
    // Region or country may already exist - look up existing
    const existing = await findExisting(query, "region", ["id", "name"])
    region = existing[0]
    logger.info("Using existing region.")
  }

  // --- Stock Location ---
  let [stockLocation] = await findExisting(query, "stock_location", ["id", "name"])
  if (!stockLocation) {
    const r = await createStockLocationsWorkflow(container).run({
      input: { locations: [{ name: "Mumbai Warehouse", address: { city: "Mumbai", country_code: "IN", address_1: "" } }] },
    })
    stockLocation = r.result[0]
    logger.info("Created stock location.")
  }

  // --- Fulfillment Set ---
  const existingSets = await fulfillmentModuleService.listFulfillmentSets({ name: "Mumbai Warehouse delivery" })
  let fulfillmentSet = existingSets[0]
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Mumbai Warehouse delivery", type: "shipping",
      service_zones: [{ name: "India", geo_zones: [{ country_code: "in", type: "country" }] }],
    })
    logger.info("Created fulfillment set.")
  }

  // --- Shipping Profile ---
  const [existingProfile] = await findExisting(query, "shipping_profile", ["id", "name"])
  let shippingProfile = existingProfile
  if (!shippingProfile) {
    const r = await createShippingProfilesWorkflow(container).run({ input: { data: [{ name: "Default", type: "default" }] } })
    shippingProfile = r.result[0]
  }

  // Link fulfillment provider BEFORE creating shipping options
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  } catch (_e) {}
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  } catch (_e) {}

  const existingOptions = await findExisting(query, "shipping_option", ["id", "name"])
  const sz = await fulfillmentModuleService.listServiceZones({ fulfillment_set_id: fulfillmentSet.id } as any)
  let serviceZoneId = sz?.[0]?.id

  if (!existingOptions.find((o: any) => o.name === "Standard Shipping")) {
    await createShippingOptionsWorkflow(container).run({
      input: [{
        name: "Standard Shipping", price_type: "flat", provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Standard", description: "Ship in 2-3 days.", code: "standard" },
        prices: [{ currency_code: "inr", amount: 10000 }, { region_id: region.id, amount: 10000 }],
        rules: [{ attribute: "enabled_in_store", value: "true", operator: "eq" }, { attribute: "is_return", value: "false", operator: "eq" }],
      }, {
        name: "Express Shipping", price_type: "flat", provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Express", description: "Ship in 24 hours.", code: "express" },
        prices: [{ currency_code: "inr", amount: 20000 }, { region_id: region.id, amount: 20000 }],
        rules: [{ attribute: "enabled_in_store", value: "true", operator: "eq" }, { attribute: "is_return", value: "false", operator: "eq" }],
      }],
    })
    logger.info("Created shipping options.")
  }

  // Link stock location to sales channel
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [defaultSalesChannel.id] },
    })
  } catch (_e) {}

  // --- Collections ---
  const existingCollections = await findExisting(query, "product_collection", ["id", "handle"])
  for (const ec of existingCollections) {
    const productModule = container.resolve(ModuleRegistrationName.PRODUCT)
    await productModule.softDeleteProductCollections([ec.id])
  }
  {
    const r = await createCollectionsWorkflow(container).run({
      input: { collections: [
        { title: "DIY Kits & Boards", handle: "diy-kits-boards" },
        { title: "Sensors & Accessories", handle: "sensors-accessories" },
        { title: "Featured Products", handle: "featured" },
      ]},
    })
    var diyKitsCollection = r.result.find((c: any) => c.handle === "diy-kits-boards")!
    var sensorsCollection = r.result.find((c: any) => c.handle === "sensors-accessories")!
    var featuredCollection = r.result.find((c: any) => c.handle === "featured")!
    logger.info("Created collections.")
  }

  // --- Categories ---
  const existingCategories = await findExisting(query, "product_category", ["id", "name"])
  for (const ec of existingCategories) {
    const catModule = container.resolve(ModuleRegistrationName.PRODUCT)
    await catModule.softDeleteProductCategories([ec.id])
  }
  {
    const r = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: [
        { name: "Development Boards", is_active: true },
        { name: "IoT & DIY Starter Kits", is_active: true },
        { name: "Sensors & Modules", is_active: true },
        { name: "Cables & Power Accessories", is_active: true },
      ]},
    })
    var catMap: Record<string, any> = {}
    for (const cat of r.result) {
      catMap[cat.name] = cat
    }
    logger.info("Created categories.")
  }

  // --- Product Options ---
  const existingOptionsData = await findExisting(query, "product_option", ["id", "title"])
  var specOption = existingOptionsData.find((o: any) => o.title === "Specification")
  var packOption = existingOptionsData.find((o: any) => o.title === "Pack Size")
  if (!specOption || !packOption) {
    const r = await createProductOptionsWorkflow(container).run({
      input: { product_options: [
        { title: "Specification", values: ["Standard", "4GB RAM", "8GB RAM"] },
        { title: "Pack Size", values: ["1-Pack", "3-Pack"] },
      ]},
    })
    specOption = specOption || r.result.find((o: any) => o.title === "Specification")!
    packOption = packOption || r.result.find((o: any) => o.title === "Pack Size")!
    logger.info("Created product options.")
  }

  // --- Products ---
  const existingProducts = await findExisting(query, "product", ["id", "handle", "title"])
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)
  for (const ep of existingProducts) {
    await productModuleService.softDeleteProducts([ep.id])
    logger.info(`Removed old product "${ep.title}" for recreation with INR prices.`)
  }
  const remainingProducts = await findExisting(query, "product", ["id", "handle"])
  const productsToCreate: any[] = []

  const productDefs = [
    {
      title: "Raspberry Pi 4 Model B", handle: "raspberry-pi-4", collection: diyKitsCollection,
      category: catMap["Development Boards"], weight: 150,
      description: "The popular single-board computer with options for 4GB or 8GB RAM. Perfect for hobbyists, students, and makers to build media centers, smart home hubs, and custom coding projects.",
      variants: [
        { title: "4GB RAM / 1-Pack", sku: "RPI4-4GB-1PK", options: { Specification: "4GB RAM", "Pack Size": "1-Pack" }, price: 5000 },
        { title: "8GB RAM / 1-Pack", sku: "RPI4-8GB-1PK", options: { Specification: "8GB RAM", "Pack Size": "1-Pack" }, price: 7000 },
      ],
    },
    {
      title: "Arduino Uno R3 Ultimate Starter Kit", handle: "arduino-starter-kit", collection: featuredCollection,
      category: catMap["IoT & DIY Starter Kits"], weight: 600,
      description: "The ultimate starter kit for students. Includes an Arduino Uno R3 compatible board, broad breadboard, jumper wires, assorted LEDs, resistors, active components, an ultrasonic sensor, servo motor, and a step-by-step guidebook.",
      variants: [{ title: "Standard / 1-Pack", sku: "ARD-KIT-1PK", options: { Specification: "Standard", "Pack Size": "1-Pack" }, price: 3200 }],
    },
    {
      title: "Arduino Uno R3 Board", handle: "arduino-uno", collection: diyKitsCollection,
      category: catMap["Development Boards"], weight: 100,
      description: "The standard microcontroller board based on ATmega328P. It has 14 digital input/output pins, 6 analog inputs, a 16 MHz ceramic resonator, and USB connection. Ideal for learning electronics basics.",
      variants: [
        { title: "Standard / 1-Pack", sku: "ARD-UNO-1PK", options: { Specification: "Standard", "Pack Size": "1-Pack" }, price: 1600 },
        { title: "Standard / 3-Pack", sku: "ARD-UNO-3PK", options: { Specification: "Standard", "Pack Size": "3-Pack" }, price: 4400 },
      ],
    },
    {
      title: "Ultrasonic Distance Sensor HC-SR04", handle: "ultrasonic-sensor", collection: sensorsCollection,
      category: catMap["Sensors & Modules"], weight: 20,
      description: "Sensing modules for obstacle detection and distance measurements. Uses ultrasonic sonar to measure distances from 2cm to 400cm with high accuracy.",
      variants: [
        { title: "Standard / 1-Pack", sku: "SNS-HCSR04-1PK", options: { Specification: "Standard", "Pack Size": "1-Pack" }, price: 300 },
        { title: "Standard / 3-Pack", sku: "SNS-HCSR04-3PK", options: { Specification: "Standard", "Pack Size": "3-Pack" }, price: 800 },
      ],
    },
    {
      title: "ESP32 NodeMCU Development Board", handle: "esp32-nodemcu", collection: diyKitsCollection,
      category: catMap["Development Boards"], weight: 40,
      description: "Powerful Wi-Fi and Bluetooth enabled development board. Ideal for IoT projects, smart home devices, and mobile sensor networks.",
      variants: [
        { title: "Standard / 1-Pack", sku: "ESP32-MCU-1PK", options: { Specification: "Standard", "Pack Size": "1-Pack" }, price: 850 },
        { title: "Standard / 3-Pack", sku: "ESP32-MCU-3PK", options: { Specification: "Standard", "Pack Size": "3-Pack" }, price: 2200 },
      ],
    },
    {
      title: "Solderless Breadboard & Jumper Wires Set", handle: "breadboard-kit", collection: sensorsCollection,
      category: catMap["Cables & Power Accessories"], weight: 250,
      description: "A premium 830-point solderless breadboard paired with a bundle of 65 male-to-male flexible jumper wires. Essential prototyping kit for students.",
      variants: [{ title: "Standard / 1-Pack", sku: "BREADBOARD-SET-1PK", options: { Specification: "Standard", "Pack Size": "1-Pack" }, price: 650 }],
    },
  ]

  for (const p of productDefs) {
    productsToCreate.push({
      title: p.title, handle: p.handle, collection_id: p.collection.id,
      category_ids: [p.category.id], description: p.description, weight: p.weight,
      status: ProductStatus.PUBLISHED, shipping_profile_id: shippingProfile.id,
      images: [{ url: `http://localhost:8000/images/${p.handle}.jpg` }],
      options: [{ id: specOption.id }, { id: packOption.id }],
      variants: p.variants.map((v: any) => ({
        title: v.title, sku: v.sku, options: v.options,
        prices: [{ amount: v.price, currency_code: "inr" }],
      })),
      sales_channels: [{ id: defaultSalesChannel.id }],
    })
  }

  if (productsToCreate.length > 0) {
    await createProductsWorkflow(container).run({ input: { products: productsToCreate } })
    logger.info(`Created ${productsToCreate.length} products.`)
  }

  // --- Inventory Levels ---
  const existingInventory = await findExisting(query, "inventory_level", ["id"])
  if (existingInventory.length === 0) {
    const { data: inventoryItems } = await query.graph({ entity: "inventory_item", fields: ["id"] })
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: inventoryItems.map((item: any) => ({
        location_id: stockLocation.id, stocked_quantity: 10000, inventory_item_id: item.id,
      }))},
    })
    logger.info("Created inventory levels.")
  }

  logger.info("Seed completed successfully.")
}
