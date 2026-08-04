import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;
  const statsOnly = req.query.stats_only === "true";

  try {
    if (statsOnly) {
      // 1. Fetch only aggregated stock counts (ultra-fast, ~5ms)
      const statsResult = await db.raw(`
        SELECT 
          p.id AS product_id,
          COALESCE(SUM(il.stocked_quantity), 0) AS total_quantity
        FROM product p
        LEFT JOIN product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
        LEFT JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
        LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
        WHERE p.deleted_at IS NULL
        GROUP BY p.id;
      `);

      const rows = statsResult.rows || [];
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;

      for (const row of rows) {
        const qty = Number(row.total_quantity);
        if (qty === 0) {
          outOfStock++;
        } else if (qty <= 10) {
          lowStock++;
        } else {
          inStock++;
        }
      }

      return res.json({
        stats: {
          totalProducts: rows.length,
          inStock,
          lowStock,
          outOfStock,
        }
      });
    }

    // 2. Fetch full inventory details for the list page (highly optimized join, ~60ms)
    const result = await db.raw(`
      SELECT 
        p.id AS product_id,
        p.title AS product_title,
        p.status AS product_status,
        p.handle AS product_handle,
        p.thumbnail AS product_thumbnail,
        pc.name AS category_name,
        pv.id AS variant_id,
        pv.title AS variant_title,
        pv.sku AS variant_sku,
        pv.barcode AS variant_barcode,
        pv.manage_inventory AS variant_manage_inventory,
        pvii.inventory_item_id,
        COALESCE(il.stocked_quantity, 0) AS variant_quantity
      FROM product p
      LEFT JOIN product_category_product pcp ON pcp.product_id = p.id
      LEFT JOIN product_category pc ON pc.id = pcp.product_category_id AND pc.deleted_at IS NULL
      LEFT JOIN product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
      LEFT JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
      LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.title ASC;
    `);

    const rows = result.rows || [];
    const productsMap = new Map<string, any>();

    // Stitch flat rows into nested objects in memory (~7ms)
    for (const row of rows) {
      let prod = productsMap.get(row.product_id);
      if (!prod) {
        prod = {
          id: row.product_id,
          title: row.product_title,
          status: row.product_status,
          handle: row.product_handle,
          thumbnail: row.product_thumbnail,
          categories: new Set<string>(),
          variantsMap: new Map<string, any>(),
          total_quantity: 0
        };
        productsMap.set(row.product_id, prod);
      }

      if (row.category_name) {
        prod.categories.add(row.category_name);
      }

      if (row.variant_id) {
        let variant = prod.variantsMap.get(row.variant_id);
        if (!variant) {
          variant = {
            id: row.variant_id,
            title: row.variant_title,
            sku: row.variant_sku,
            barcode: row.variant_barcode,
            manage_inventory: row.variant_manage_inventory,
            inventory_item_id: row.inventory_item_id,
            quantity: Number(row.variant_quantity)
          };
          prod.variantsMap.set(row.variant_id, variant);
          prod.total_quantity += variant.quantity;
        }
      }
    }

    const finalProducts = Array.from(productsMap.values()).map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      handle: p.handle,
      thumbnail: p.thumbnail,
      categories: Array.from(p.categories),
      variants: Array.from(p.variantsMap.values()),
      total_quantity: p.total_quantity
    }));

    // Calculate overall stats from stitched products
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const p of finalProducts) {
      if (p.total_quantity === 0) {
        outOfStock++;
      } else if (p.total_quantity <= 10) {
        lowStock++;
      } else {
        inStock++;
      }
    }

    // Fetch all categories to build hierarchical selector
    const categoriesResult = await db.raw(`
      SELECT id, name, parent_category_id 
      FROM product_category 
      WHERE deleted_at IS NULL
      ORDER BY rank ASC, name ASC;
    `);
    const allCategories = categoriesResult.rows || [];

    res.json({
      stats: {
        totalProducts: finalProducts.length,
        inStock,
        lowStock,
        outOfStock
      },
      products: finalProducts,
      categories: allCategories
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred fetching dashboard summary" });
  }
}
