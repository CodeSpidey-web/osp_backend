import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ModuleRegistrationName } from "@medusajs/framework/utils";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;
  const productModuleService = req.scope.resolve(ModuleRegistrationName.PRODUCT);

  try {
    // 1. Fetch all product-category associations (product_id and product_category_id)
    const associationsResult = await db.raw(`
      SELECT product_id, product_category_id 
      FROM product_category_product
    `);
    
    // Group direct product IDs by category ID
    const directProductIds: Record<string, Set<string>> = {};
    
    if (associationsResult && associationsResult.rows) {
      for (const row of associationsResult.rows) {
        const catId = row.product_category_id;
        const prodId = row.product_id;
        if (!directProductIds[catId]) {
          directProductIds[catId] = new Set<string>();
        }
        directProductIds[catId].add(prodId);
      }
    }

    // 2. Fetch categories list
    const categories = await productModuleService.listProductCategories(
      {},
      { select: ["id", "parent_category_id"], relations: ["category_children"] }
    );

    // Build map for easy lookup
    const categoriesMap = new Map<string, any>();
    for (const cat of categories) {
      categoriesMap.set(cat.id, cat);
    }

    // 3. Compute unique product ID sets recursively
    const recursiveProductIds: Record<string, Set<string>> = {};

    const getRecursiveProductIds = (catId: string): Set<string> => {
      if (recursiveProductIds[catId] !== undefined) {
        return recursiveProductIds[catId];
      }

      const cat = categoriesMap.get(catId);
      if (!cat) {
        const emptySet = new Set<string>();
        recursiveProductIds[catId] = emptySet;
        return emptySet;
      }

      // Initialize with direct products
      const unionSet = new Set<string>(directProductIds[catId] || []);

      // Add all descendants' products recursively
      if (cat.category_children) {
        for (const child of cat.category_children) {
          const childProducts = getRecursiveProductIds(child.id);
          for (const pid of childProducts) {
            unionSet.add(pid);
          }
        }
      }

      recursiveProductIds[catId] = unionSet;
      return unionSet;
    };

    // Calculate recursive sets for all categories
    for (const cat of categories) {
      getRecursiveProductIds(cat.id);
    }

    // Convert sets to count values
    const recursiveCounts: Record<string, number> = {};
    for (const cat of categories) {
      recursiveCounts[cat.id] = recursiveProductIds[cat.id]?.size || 0;
    }

    res.json({ counts: recursiveCounts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
