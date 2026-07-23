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
const path = __importStar(require("path"));
function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        }
        else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        }
        else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
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
    logger.info("Starting Techtonics product import...");
    // 1. Read CSV
    const possiblePaths = [
        path.join(process.cwd(), "techtonics_products.csv"),
        path.join(process.cwd(), "..", "techtonics_products.csv"),
        path.join(process.cwd(), "..", "..", "techtonics_products.csv"),
    ];
    let csvPath = "";
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            csvPath = p;
            break;
        }
    }
    if (!csvPath) {
        logger.error("Could not find techtonics_products.csv. Tried: " + possiblePaths.join(", "));
        return;
    }
    logger.info(`Reading CSV from: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n");
    const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
    // 2. Parse and deduplicate by URL
    const productMap = new Map();
    for (const line of dataLines) {
        const fields = parseCSVLine(line);
        if (fields.length < 6)
            continue;
        const [categoryName, , productName, priceStr, stockStatus, url] = fields;
        const price = parsePrice(priceStr);
        const existing = productMap.get(url);
        if (existing) {
            if (!existing.categories.includes(categoryName)) {
                existing.categories.push(categoryName);
            }
        }
        else {
            productMap.set(url, {
                productName,
                price,
                stockStatus: stockStatus.trim(),
                url,
                categories: [categoryName],
            });
        }
    }
    logger.info(`Parsed ${productMap.size} unique products from CSV`);
    // 3. Look up existing categories (case-insensitive match)
    const categories = await findExisting(query, "product_category", [
        "id",
        "name",
        "handle",
        "parent_category_id",
    ]);
    const categoryByName = {};
    for (const cat of categories) {
        categoryByName[cat.name.toLowerCase().trim()] = cat;
    }
    logger.info(`Found ${categories.length} existing categories in DB`);
    // Log which categories from CSV exist vs. missing
    const allCsvCategoryNames = new Set();
    for (const [, entry] of productMap) {
        for (const cat of entry.categories) {
            allCsvCategoryNames.add(cat);
        }
    }
    const missingCategories = [];
    for (const catName of allCsvCategoryNames) {
        if (!categoryByName[catName.toLowerCase().trim()]) {
            missingCategories.push(catName);
        }
    }
    if (missingCategories.length > 0) {
        logger.warn(`The following CSV categories were NOT found in the database. Products in these will be skipped:\n  - ${missingCategories.join("\n  - ")}`);
    }
    // 4. Find or create a "Specification" product option
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
    // 5. Find existing entities needed for product creation
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
    // 6. Build products array
    const productsToCreate = [];
    const usedHandles = new Set();
    for (const [, entry] of productMap) {
        // Resolve category IDs
        const categoryIds = [];
        for (const catName of entry.categories) {
            const cat = categoryByName[catName.toLowerCase().trim()];
            if (cat) {
                categoryIds.push(cat.id);
            }
        }
        if (categoryIds.length === 0) {
            logger.warn(`Skipping "${entry.productName.substring(0, 60)}..." - no matching category`);
            continue;
        }
        // Generate unique handle
        let baseHandle = generateHandle(entry.productName);
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
        const sku = "TEC_" + handle.toUpperCase().replace(/-/g, "_");
        if (existingSkus.has(sku)) {
            logger.info(`Skipping "${entry.productName.substring(0, 60)}..." - SKU already exists (${sku})`);
            continue;
        }
        productsToCreate.push({
            title: entry.productName,
            handle,
            category_ids: categoryIds,
            status: utils_1.ProductStatus.PUBLISHED,
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
        });
    }
    if (productsToCreate.length === 0) {
        logger.info("No products to create.");
        return;
    }
    // 7. Create products in batches
    const batchSize = 25;
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
    // 8. Set inventory levels
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0LXRlY2h0b25pY3MtcHJvZHVjdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbWlncmF0aW9uLXNjcmlwdHMvaW1wb3J0LXRlY2h0b25pY3MtcHJvZHVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzRUEsMkNBNlFDO0FBbFZELHFEQUlrQztBQUNsQyw0REFJb0M7QUFDcEMsdUNBQXdCO0FBQ3hCLDJDQUE0QjtBQUU1QixTQUFTLFlBQVksQ0FBQyxJQUFZO0lBQ2hDLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQTtJQUMzQixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFDaEIsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFBO0lBQ3BCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDckMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3BCLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ2pCLFFBQVEsR0FBRyxDQUFDLFFBQVEsQ0FBQTtRQUN0QixDQUFDO2FBQU0sSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQTtZQUMzQixPQUFPLEdBQUcsRUFBRSxDQUFBO1FBQ2QsQ0FBQzthQUFNLENBQUM7WUFDTixPQUFPLElBQUksSUFBSSxDQUFBO1FBQ2pCLENBQUM7SUFDSCxDQUFDO0lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQTtJQUMzQixPQUFPLE1BQU0sQ0FBQTtBQUNmLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FB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