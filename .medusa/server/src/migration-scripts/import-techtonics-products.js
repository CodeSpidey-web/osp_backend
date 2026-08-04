"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = importTechtonicsProducts;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
const fs = __importStar(require("fs"));
function parsePrice(priceStr) {
    const cleaned = priceStr
        .replace(/₹/g, "")
        .replace(/\(incl\.?\s*GST\)/g, "")
        .replace(/,/g, "")
        .trim();
    const amount = parseFloat(cleaned);
    if (isNaN(amount))
        return 0;
    return Math.round(amount * 100);
}
function generateHandle(name) {
    let handle = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100)
        .replace(/-+$/g, "");
    if (!handle || /[^a-z0-9-]/.test(handle)) {
        handle = "product-" + Math.random().toString(36).substring(2, 8);
    }
    return handle;
}
async function findExisting(query, entity, fields) {
    const result = await query.graph({ entity, fields });
    return result.data;
}
async function importTechtonicsProducts({ container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const productModuleService = container.resolve(utils_1.ModuleRegistrationName.PRODUCT);
    logger.info("Starting Techtonics JSON product import...");
    const filePath = "X:/CodeSpidey/Client Demos/ecommerce_ocean/public/techtonics_scraper_fixed/techtonics_scraper/output/products.json";
    if (!fs.existsSync(filePath)) {
        logger.error(`Source file not found at: ${filePath}`);
        return;
    }
    logger.info(`Reading products JSON from: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const scrapedProducts = JSON.parse(fileContent);
    logger.info(`Loaded ${scrapedProducts.length} products from JSON file.`);
    // 1. Fetch existing categories and build path key to ID map
    const categories = await productModuleService.listProductCategories({}, { select: ["id", "handle", "parent_category_id"] });
    const categoriesMap = new Map();
    for (const cat of categories) {
        categoriesMap.set(cat.id, cat);
    }
    const buildPathKey = (cat) => {
        const pathList = [cat.handle];
        let parentId = cat.parent_category_id;
        while (parentId) {
            const parent = categoriesMap.get(parentId);
            if (parent) {
                pathList.unshift(parent.handle);
                parentId = parent.parent_category_id;
            }
            else {
                break;
            }
        }
        return pathList.join("/");
    };
    const categoryPathIdMap = new Map();
    for (const cat of categories) {
        const key = buildPathKey(cat);
        categoryPathIdMap.set(key, cat.id);
    }
    logger.info(`Mapped ${categoryPathIdMap.size} database categories.`);
    // 2. Find or create a "Specification" product option
    const existingOptions = await findExisting(query, "product_option", [
        "id",
        "title",
    ]);
    let productOption = existingOptions.find((o) => o.title === "Specification");
    if (!productOption) {
        logger.info('Creating "Specification" product option...');
        const r = await (0, core_flows_1.createProductOptionsWorkflow)(container).run({
            input: {
                product_options: [{ title: "Specification", values: ["Standard"] }],
            },
        });
        productOption = r.result[0];
    }
    // 3. Find existing entities needed for product creation
    const [defaultSalesChannel] = await findExisting(query, "sales_channel", [
        "id",
        "name",
    ]);
    if (!defaultSalesChannel) {
        logger.error("No sales channel found. Run the seed script first.");
        return;
    }
    const [shippingProfile] = await findExisting(query, "shipping_profile", [
        "id",
        "name",
    ]);
    if (!shippingProfile) {
        logger.error("No shipping profile found. Run the seed script first.");
        return;
    }
    const [stockLocation] = await findExisting(query, "stock_location", [
        "id",
        "name",
    ]);
    // Check existing product handles and SKUs to avoid conflicts
    const existingProducts = await findExisting(query, "product", [
        "id",
        "handle",
        "title",
    ]);
    const existingHandles = new Set(existingProducts.map((p) => p.handle));
    const { data: existingVariants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "sku"],
    });
    const existingSkus = new Set(existingVariants.map((v) => v.sku).filter(Boolean));
    logger.info(`Found ${existingHandles.size} existing products and ${existingSkus.size} existing SKUs`);
    // 4. Build products array
    const productsToCreate = [];
    const usedHandles = new Set();
    for (const entry of scrapedProducts) {
        // Resolve category IDs using path slugs
        const categoryIds = [];
        const entryCategories = entry.categories || [];
        for (const cat of entryCategories) {
            if (cat.path_slugs) {
                const pathKey = cat.path_slugs.join("/");
                const catId = categoryPathIdMap.get(pathKey);
                if (catId && !categoryIds.includes(catId)) {
                    categoryIds.push(catId);
                }
            }
        }
        if (categoryIds.length === 0) {
            // Fallback: match by name case-insensitive
            for (const cat of entryCategories) {
                const matchingCat = categories.find(c => c.name?.toLowerCase().trim() === cat.name?.toLowerCase().trim());
                if (matchingCat && !categoryIds.includes(matchingCat.id)) {
                    categoryIds.push(matchingCat.id);
                }
            }
        }
        // Generate unique handle
        let baseHandle = generateHandle(entry.name);
        if (!baseHandle) {
            baseHandle = "product";
        }
        let handle = baseHandle;
        if (existingHandles.has(handle) || usedHandles.has(handle)) {
            let suffix = 2;
            while (existingHandles.has(`${handle}-${suffix}`) ||
                usedHandles.has(`${handle}-${suffix}`)) {
                suffix++;
            }
            handle = `${baseHandle}-${suffix}`;
        }
        usedHandles.add(handle);
        // Standardize SKU
        const sku = entry.sku ? entry.sku.trim() : "TEC_" + handle.toUpperCase().replace(/-/g, "_");
        if (existingSkus.has(sku)) {
            logger.info(`Skipping "${entry.name.substring(0, 60)}..." - SKU already exists (${sku})`);
            continue;
        }
        // Process images
        let thumbnail = undefined;
        const images = [];
        if (entry.local_images && entry.local_images.length > 0) {
            const normalizedPaths = entry.local_images.map(img => {
                const normalized = '/' + img.replace(/\\/g, '/');
                return normalized;
            });
            thumbnail = normalizedPaths[0];
            normalizedPaths.forEach(pathUrl => {
                images.push({ url: pathUrl });
            });
        }
        else if (entry.images && entry.images.length > 0) {
            thumbnail = entry.images[0];
            entry.images.forEach(imgUrl => {
                images.push({ url: imgUrl });
            });
        }
        const price = parsePrice(entry.price_text);
        productsToCreate.push({
            title: entry.name,
            handle,
            description: entry.description_html || "",
            category_ids: categoryIds,
            thumbnail,
            images,
            status: utils_1.ProductStatus.PUBLISHED,
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
        });
    }
    if (productsToCreate.length === 0) {
        logger.info("No products to create.");
        return;
    }
    logger.info(`Batched ${productsToCreate.length} products for database insertion.`);
    // 5. Create products in batches
    const batchSize = 50;
    let createdCount = 0;
    for (let i = 0; i < productsToCreate.length; i += batchSize) {
        const batch = productsToCreate.slice(i, i + batchSize);
        try {
            await (0, core_flows_1.createProductsWorkflow)(container).run({
                input: { products: batch },
            });
            createdCount += batch.length;
            logger.info(`Created products ${i + 1} - ${Math.min(i + batchSize, productsToCreate.length)} (${createdCount}/${productsToCreate.length})`);
        }
        catch (error) {
            logger.error(`Error creating products batch ${i}-${i + batch.length}: ${error?.message || error}`);
        }
    }
    logger.info(`Successfully created ${createdCount} products.`);
    // 6. Set inventory levels
    if (stockLocation) {
        try {
            const { data: inventoryItems } = await query.graph({
                entity: "inventory_item",
                fields: ["id"],
            });
            const inventoryLevels = inventoryItems.map((item) => ({
                location_id: stockLocation.id,
                inventory_item_id: item.id,
                stocked_quantity: 100,
            }));
            await (0, core_flows_1.createInventoryLevelsWorkflow)(container).run({
                input: { inventory_levels: inventoryLevels },
            });
            logger.info(`Set inventory levels for ${inventoryLevels.length} items at ${stockLocation.name}.`);
        }
        catch (error) {
            logger.error(`Error setting inventory levels: ${error?.message || error}`);
        }
    }
    else {
        logger.warn("No stock location found - skipping inventory level setup.");
    }
    logger.info("Techtonics product import completed successfully!");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0LXRlY2h0b25pY3MtcHJvZHVjdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbWlncmF0aW9uLXNjcmlwdHMvaW1wb3J0LXRlY2h0b25pY3MtcHJvZHVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2REEsMkNBb1JDO0FBaFZELHFEQUlrQztBQUNsQyw0REFJb0M7QUFDcEMsdUNBQXdCO0FBR3hCLFNBQVMsVUFBVSxDQUFDLFFBQWdCO0lBQ2xDLE1BQU0sT0FBTyxHQUFHLFFBQVE7U0FDckIsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7U0FDakIsT0FBTyxDQUFDLG9CQUFvQixFQUFFLEVBQUUsQ0FBQztTQUNqQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztTQUNqQixJQUFJLEVBQUUsQ0FBQTtJQUNULE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUNsQyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFBRSxPQUFPLENBQUMsQ0FBQTtJQUMzQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FBQyxJQUFZO0lBQ2xDLElBQUksTUFBTSxHQUFHLElBQUk7U0FDZCxXQUFXLEVBQUU7U0FDYixPQUFPLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQztTQUMzQixPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztTQUN2QixTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQztTQUNqQixPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFBO0lBQ3RCLElBQUksQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sR0FBRyxV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