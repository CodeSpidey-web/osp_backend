"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = cleanupDuplicateImports;
const utils_1 = require("@medusajs/framework/utils");
async function findExisting(query, entity, fields) {
    const result = await query.graph({ entity, fields });
    return result.data;
}
async function cleanupDuplicateImports({ container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const productModuleService = container.resolve(utils_1.ModuleRegistrationName.PRODUCT);
    // Find all variants with old-style SKUs (no TEC_ prefix)
    const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "sku", "product_id"],
    });
    const oldVariants = variants.filter((v) => v.sku &&
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
        v.sku !== "BREADBOARD-SET-1PK");
    if (oldVariants.length === 0) {
        logger.info("No old-format products found to clean up.");
        return;
    }
    // Get unique product IDs
    const productIds = [...new Set(oldVariants.map((v) => v.product_id))];
    logger.info(`Found ${productIds.length} products with old SKU format. Deleting...`);
    // Delete products
    for (const id of productIds) {
        try {
            await productModuleService.softDeleteProducts([id]);
        }
        catch (e) {
            logger.error(`Error deleting product ${id}: ${e.message}`);
        }
    }
    logger.info(`Deleted ${productIds.length} duplicate products from first run.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYW51cC1kdXBsaWNhdGUtaW1wb3J0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9taWdyYXRpb24tc2NyaXB0cy9jbGVhbnVwLWR1cGxpY2F0ZS1pbXBvcnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBV0EsMENBc0RDO0FBaEVELHFEQUdrQztBQUVsQyxLQUFLLFVBQVUsWUFBWSxDQUFDLEtBQVUsRUFBRSxNQUFjLEVBQUUsTUFBZ0I7SUFDdEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUE7SUFDcEQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFBO0FBQ3BCLENBQUM7QUFFYyxLQUFLLFVBQVUsdUJBQXVCLENBQUMsRUFDcEQsU0FBUyxHQUdWO0lBQ0MsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUNsRSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFBO0lBQ2hFLE1BQU0sb0JBQW9CLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FDNUMsOEJBQXNCLENBQUMsT0FBTyxDQUMvQixDQUFBO0lBRUQseURBQXlEO0lBQ3pELE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzNDLE1BQU0sRUFBRSxpQkFBaUI7UUFDekIsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUM7S0FDcEMsQ0FBQyxDQUFBO0lBRUYsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FDakMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUNULENBQUMsQ0FBQyxHQUFHO1FBQ0wsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7UUFDekIsQ0FBQyxDQUFDLEdBQUcsS0FBSyxjQUFjO1FBQ3hCLENBQUMsQ0FBQyxHQUFHLEtBQUssY0FBYztRQUN4QixDQUFDLENBQUMsR0FBRyxLQUFLLGFBQWE7UUFDdkIsQ0FBQyxDQUFDLEdBQUcsS0FBSyxhQUFhO1FBQ3ZCLENBQUMsQ0FBQyxHQUFHLEtBQUssYUFBYTtRQUN2QixDQUFDLENBQUMsR0FBRyxLQUFLLGdCQUFnQjtRQUMxQixDQUFDLENBQUMsR0FBRyxLQUFLLGdCQUFnQjtRQUMxQixDQUFDLENBQUMsR0FBRyxLQUFLLGVBQWU7UUFDekIsQ0FBQyxDQUFDLEdBQUcsS0FBSyxlQUFlO1FBQ3pCLENBQUMsQ0FBQyxHQUFHLEtBQUssb0JBQW9CLENBQ2pDLENBQUE7SUFFRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQywyQ0FBMkMsQ0FBQyxDQUFBO1FBQ3hELE9BQU07SUFDUixDQUFDO0lBRUQseUJBQXlCO0lBQ3pCLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQzFFLE1BQU0sQ0FBQyxJQUFJLENBQ1QsU0FBUyxVQUFVLENBQUMsTUFBTSw0Q0FBNEMsQ0FDdkUsQ0FBQTtJQUVELGtCQUFrQjtJQUNsQixLQUFLLE1BQU0sRUFBRSxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQztZQUNILE1BQU0sb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO1FBQ3JELENBQUM7UUFBQyxPQUFPLENBQU0sRUFBRSxDQUFDO1lBQ2hCLE1BQU0sQ0FBQyxLQUFLLENBQUMsMEJBQTBCLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQTtRQUM1RCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxVQUFVLENBQUMsTUFBTSxxQ0FBcUMsQ0FBQyxDQUFBO0FBQ2hGLENBQUMifQ==