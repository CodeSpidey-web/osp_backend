"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = initial_data_seed;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
async function findExisting(query, entity, fields) {
    const result = await query.graph({ entity, fields });
    return result.data;
}
async function initial_data_seed({ container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const link = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fulfillmentModuleService = container.resolve(utils_1.ModuleRegistrationName.FULFILLMENT);
    const countries = ["in"];
    logger.info("Checking existing data...");
    // --- Sales Channel ---
    let [defaultSalesChannel] = await findExisting(query, "sales_channel", ["id", "name"]);
    if (!defaultSalesChannel) {
        const r = await (0, core_flows_1.createSalesChannelsWorkflow)(container).run({
            input: { salesChannelsData: [{ name: "Default Sales Channel", description: "Created by Medusa" }] },
        });
        defaultSalesChannel = r.result[0];
        logger.info("Created sales channel.");
    }
    // --- API Key ---
    let [publishableApiKey] = await findExisting(query, "api_key", ["id", "title"]);
    if (!publishableApiKey) {
        const r = await (0, core_flows_1.createApiKeysWorkflow)(container).run({
            input: { api_keys: [{ title: "Default Publishable API Key", type: "publishable", created_by: "" }] },
        });
        publishableApiKey = r.result[0];
        logger.info("Created API key.");
        await (0, core_flows_1.linkSalesChannelsToApiKeyWorkflow)(container).run({
            input: { id: publishableApiKey.id, add: [defaultSalesChannel.id] },
        });
    }
    // --- Store ---
    let [store] = await findExisting(query, "store", ["id", "name"]);
    if (!store) {
        const r = await (0, core_flows_1.createStoresWorkflow)(container).run({
            input: {
                stores: [{
                        name: "Ocean Student Projects",
                        supported_currencies: [{ currency_code: "inr", is_default: true }],
                        default_sales_channel_id: defaultSalesChannel.id,
                    }],
            },
        });
        store = r.result[0];
        logger.info("Created store.");
    }
    // --- Region ---
    let region = null;
    try {
        const r = await (0, core_flows_1.createRegionsWorkflow)(container).run({
            input: { regions: [{ name: "India", currency_code: "inr", countries, payment_providers: ["pp_system_default"] }] },
        });
        region = r.result[0];
        logger.info("Created India region with INR.");
        await (0, core_flows_1.createTaxRegionsWorkflow)(container).run({ input: countries.map((c) => ({ country_code: c, provider_id: "tp_system" })) });
        logger.info("Seeded tax regions.");
    }
    catch (_e) {
        // Region or country may already exist - look up existing
        const existing = await findExisting(query, "region", ["id", "name"]);
        region = existing[0];
        logger.info("Using existing region.");
    }
    // --- Stock Location ---
    let [stockLocation] = await findExisting(query, "stock_location", ["id", "name"]);
    if (!stockLocation) {
        const r = await (0, core_flows_1.createStockLocationsWorkflow)(container).run({
            input: { locations: [{ name: "Mumbai Warehouse", address: { city: "Mumbai", country_code: "IN", address_1: "" } }] },
        });
        stockLocation = r.result[0];
        logger.info("Created stock location.");
    }
    // --- Fulfillment Set ---
    const existingSets = await fulfillmentModuleService.listFulfillmentSets({ name: "Mumbai Warehouse delivery" });
    let fulfillmentSet = existingSets[0];
    if (!fulfillmentSet) {
        fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
            name: "Mumbai Warehouse delivery", type: "shipping",
            service_zones: [{ name: "India", geo_zones: [{ country_code: "in", type: "country" }] }],
        });
        logger.info("Created fulfillment set.");
    }
    // --- Shipping Profile ---
    const [existingProfile] = await findExisting(query, "shipping_profile", ["id", "name"]);
    let shippingProfile = existingProfile;
    if (!shippingProfile) {
        const r = await (0, core_flows_1.createShippingProfilesWorkflow)(container).run({ input: { data: [{ name: "Default", type: "default" }] } });
        shippingProfile = r.result[0];
    }
    // Link fulfillment provider BEFORE creating shipping options
    try {
        await link.create({
            [utils_1.Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [utils_1.Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
        });
    }
    catch (_e) { }
    try {
        await link.create({
            [utils_1.Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [utils_1.Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
        });
    }
    catch (_e) { }
    const existingOptions = await findExisting(query, "shipping_option", ["id", "name"]);
    const sz = await fulfillmentModuleService.listServiceZones({ fulfillment_set_id: fulfillmentSet.id });
    let serviceZoneId = sz?.[0]?.id;
    if (!existingOptions.find((o) => o.name === "Standard Shipping")) {
        await (0, core_flows_1.createShippingOptionsWorkflow)(container).run({
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
        });
        logger.info("Created shipping options.");
    }
    // Link stock location to sales channel
    try {
        await (0, core_flows_1.linkSalesChannelsToStockLocationWorkflow)(container).run({
            input: { id: stockLocation.id, add: [defaultSalesChannel.id] },
        });
    }
    catch (_e) { }
    // --- Collections ---
    const existingCollections = await findExisting(query, "product_collection", ["id", "handle"]);
    for (const ec of existingCollections) {
        const productModule = container.resolve(utils_1.ModuleRegistrationName.PRODUCT);
        await productModule.softDeleteProductCollections([ec.id]);
    }
    {
        const r = await (0, core_flows_1.createCollectionsWorkflow)(container).run({
            input: { collections: [
                    { title: "DIY Kits & Boards", handle: "diy-kits-boards" },
                    { title: "Sensors & Accessories", handle: "sensors-accessories" },
                    { title: "Featured Products", handle: "featured" },
                ] },
        });
        var diyKitsCollection = r.result.find((c) => c.handle === "diy-kits-boards");
        var sensorsCollection = r.result.find((c) => c.handle === "sensors-accessories");
        var featuredCollection = r.result.find((c) => c.handle === "featured");
        logger.info("Created collections.");
    }
    // --- Categories ---
    const existingCategories = await findExisting(query, "product_category", ["id", "name"]);
    for (const ec of existingCategories) {
        const catModule = container.resolve(utils_1.ModuleRegistrationName.PRODUCT);
        await catModule.softDeleteProductCategories([ec.id]);
    }
    {
        const r = await (0, core_flows_1.createProductCategoriesWorkflow)(container).run({
            input: { product_categories: [
                    { name: "Development Boards", is_active: true },
                    { name: "IoT & DIY Starter Kits", is_active: true },
                    { name: "Sensors & Modules", is_active: true },
                    { name: "Cables & Power Accessories", is_active: true },
                ] },
        });
        var catMap = {};
        for (const cat of r.result) {
            catMap[cat.name] = cat;
        }
        logger.info("Created categories.");
    }
    // --- Product Options ---
    const existingOptionsData = await findExisting(query, "product_option", ["id", "title"]);
    var specOption = existingOptionsData.find((o) => o.title === "Specification");
    var packOption = existingOptionsData.find((o) => o.title === "Pack Size");
    if (!specOption || !packOption) {
        const r = await (0, core_flows_1.createProductOptionsWorkflow)(container).run({
            input: { product_options: [
                    { title: "Specification", values: ["Standard", "4GB RAM", "8GB RAM"] },
                    { title: "Pack Size", values: ["1-Pack", "3-Pack"] },
                ] },
        });
        specOption = specOption || r.result.find((o) => o.title === "Specification");
        packOption = packOption || r.result.find((o) => o.title === "Pack Size");
        logger.info("Created product options.");
    }
    // --- Products ---
    const existingProducts = await findExisting(query, "product", ["id", "handle", "title"]);
    const productModuleService = container.resolve(utils_1.ModuleRegistrationName.PRODUCT);
    for (const ep of existingProducts) {
        await productModuleService.softDeleteProducts([ep.id]);
        logger.info(`Removed old product "${ep.title}" for recreation with INR prices.`);
    }
    const remainingProducts = await findExisting(query, "product", ["id", "handle"]);
    const productsToCreate = [];
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
    ];
    for (const p of productDefs) {
        productsToCreate.push({
            title: p.title, handle: p.handle, collection_id: p.collection.id,
            category_ids: [p.category.id], description: p.description, weight: p.weight,
            status: utils_1.ProductStatus.PUBLISHED, shipping_profile_id: shippingProfile.id,
            images: [{ url: `http://localhost:8000/images/${p.handle}.jpg` }],
            options: [{ id: specOption.id }, { id: packOption.id }],
            variants: p.variants.map((v) => ({
                title: v.title, sku: v.sku, options: v.options,
                prices: [{ amount: v.price, currency_code: "inr" }],
            })),
            sales_channels: [{ id: defaultSalesChannel.id }],
        });
    }
    if (productsToCreate.length > 0) {
        await (0, core_flows_1.createProductsWorkflow)(container).run({ input: { products: productsToCreate } });
        logger.info(`Created ${productsToCreate.length} products.`);
    }
    // --- Inventory Levels ---
    const existingInventory = await findExisting(query, "inventory_level", ["id"]);
    if (existingInventory.length === 0) {
        const { data: inventoryItems } = await query.graph({ entity: "inventory_item", fields: ["id"] });
        await (0, core_flows_1.createInventoryLevelsWorkflow)(container).run({
            input: { inventory_levels: inventoryItems.map((item) => ({
                    location_id: stockLocation.id, stocked_quantity: 10000, inventory_item_id: item.id,
                })) },
        });
        logger.info("Created inventory levels.");
    }
    logger.info("Seed completed successfully.");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5pdGlhbC1kYXRhLXNlZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbWlncmF0aW9uLXNjcmlwdHMvaW5pdGlhbC1kYXRhLXNlZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUE4QkEsb0NBMlNDO0FBeFVELHFEQUttQztBQUNuQyw0REFnQnFDO0FBRXJDLEtBQUssVUFBVSxZQUFZLENBQUMsS0FBVSxFQUFFLE1BQWMsRUFBRSxNQUFnQjtJQUN0RSxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQTtJQUNwRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUE7QUFDcEIsQ0FBQztBQUVjLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxFQUM5QyxTQUFTLEdBR1Y7SUFDQyxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25FLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0QsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRSxNQUFNLHdCQUF3QixHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQ2hELDhCQUFzQixDQUFDLFdBQVcsQ0FDbkMsQ0FBQztJQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFekIsTUFBTSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBRXpDLHdCQUF3QjtJQUN4QixJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxNQUFNLFlBQVksQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7SUFDdEYsSUFBSSxDQUFD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