import { defineMiddlewares } from "@medusajs/medusa"
import { Request, Response, NextFunction } from "express"

function uppercaseCurrencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Disable HTTP caching and ETags to prevent browser 304 cached responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const originalJson = res.json;
  res.json = function (body: any) {
    res.removeHeader('ETag');
    console.log(`[Middleware Interceptor] Path: ${req.originalUrl || req.url}`);
    let currencyCodesFound: string[] = [];
    const recursiveProcess = (obj: any): any => {
      if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
        if (Array.isArray(obj)) {
          return obj.map(recursiveProcess);
        }
        const newObj = { ...obj };
        for (const key in newObj) {
          if (key === 'currency_code' && typeof newObj[key] === 'string') {
            currencyCodesFound.push(newObj[key]);
            if (newObj[key].toLowerCase() === 'inr') {
              newObj[key] = 'INR';
            }
          } else if (typeof newObj[key] === 'string' && newObj[key].startsWith('/images/')) {
            const storefrontUrl = process.env.STOREFRONT_URL || 'http://localhost:3000';
            console.log(`[Middleware Interceptor] Replacing image path for key ${key}: ${newObj[key]} -> ${storefrontUrl}${newObj[key]}`);
            newObj[key] = `${storefrontUrl}${newObj[key]}`;
          } else {
            newObj[key] = recursiveProcess(newObj[key]);
          }
        }
        return newObj;
      }
      return obj;
    };
    
    let processedBody = body;
    try {
      processedBody = recursiveProcess(body);
      if (currencyCodesFound.length > 0) {
        console.log(`[Middleware Interceptor] Found currency codes: ${JSON.stringify(currencyCodesFound)} -> updated to INR`);
      }
    } catch (e) {
      console.error("Error in uppercaseCurrencyMiddleware:", e);
    }
    return originalJson.call(this, processedBody);
  };
  next();
}

async function validateCartAdditionMiddleware(req: Request, res: Response, next: NextFunction) {
  // We only care about line-items addition: /store/carts/:id/line-items
  if (!req.path.endsWith('/line-items') || req.method !== 'POST') {
    return next();
  }

  const { variant_id } = req.body as { variant_id?: string };
  if (!variant_id) {
    return next();
  }

  try {
    const projectParentId = process.env.PROJECT_PARENT_CATEGORY_ID;
    if (!projectParentId) {
      console.error("CRITICAL ERROR: PROJECT_PARENT_CATEGORY_ID environment variable is missing!");
      return res.status(500).json({
        type: "missing_config",
        message: "Store configuration error: PROJECT_PARENT_CATEGORY_ID is not defined."
      });
    }

    const db = req.scope.resolve("__pg_connection__") as any;
    const result = await db.raw(`
      WITH RECURSIVE category_path AS (
        SELECT pcp.product_category_id AS id, pc.parent_category_id
        FROM product_variant pv
        JOIN product_category_product pcp ON pcp.product_id = pv.product_id
        JOIN product_category pc ON pc.id = pcp.product_category_id
        WHERE pv.id = ? AND pc.deleted_at IS NULL AND pv.deleted_at IS NULL
        
        UNION ALL
        
        SELECT parent.id, parent.parent_category_id
        FROM product_category parent
        JOIN category_path child ON child.parent_category_id = parent.id
        WHERE parent.deleted_at IS NULL
      )
      SELECT id FROM category_path WHERE id = ?;
    `, [variant_id, projectParentId]);

    if (result.rows && result.rows.length > 0) {
      return res.status(400).json({
        type: "not_allowed",
        message: "Custom projects cannot be added to the shopping cart. Please use the 'Order Now' WhatsApp flow on the product page."
      });
    }
  } catch (err) {
    console.error("Error in validateCartAdditionMiddleware:", err);
  }

  next();
}

async function adminProductSearchMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' || !req.query.q) {
    return next();
  }

  const q = String(req.query.q).trim();
  if (!q) {
    return next();
  }

  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

  try {
    const db = req.scope.resolve("__pg_connection__") as any;

    const keywords = q.split(/\s+/).filter(w => w.length > 0);
    if (keywords.length === 0) {
      return next();
    }

    const exactMatch = q.toLowerCase();
    const startsWithPattern = `${exactMatch}%`;
    const containsPattern = `%${exactMatch}%`;
    
    const escapedQuery = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const wordBoundaryPattern = `\\y${escapedQuery}\\y`;

    const sqlParams: any[] = [
      exactMatch,             // Exact title
      startsWithPattern,      // Starts with
      containsPattern,        // Contains
      wordBoundaryPattern,    // Word boundary
      keywords,               // Keywords array
      exactMatch,             // Exact SKU
      exactMatch,             // SKU contains
      exactMatch,             // Exact category
      exactMatch              // Category contains
    ];

    const whereClauses = ["p.deleted_at IS NULL"];

    if (req.query.status) {
      if (Array.isArray(req.query.status)) {
        whereClauses.push("p.status = ANY(?)");
        sqlParams.push(req.query.status);
      } else {
        whereClauses.push("p.status = ?");
        sqlParams.push(req.query.status);
      }
    }

    const whereSql = whereClauses.join(" AND ");

    const sql = `
      WITH product_scoring AS (
        SELECT 
          p.id,
          (
            -- Priority 1: Exact title match
            CASE WHEN LOWER(p.title) = ? THEN 100000 ELSE 0 END +
            -- Priority 2: Title starts with search term
            CASE WHEN LOWER(p.title) LIKE ? THEN 80000 ELSE 0 END +
            -- Priority 3: Title contains search term
            CASE WHEN LOWER(p.title) LIKE ? THEN 50000 ELSE 0 END +
            -- Priority 4: Word boundary match
            CASE WHEN LOWER(p.title) ~* ? THEN 30000 ELSE 0 END +
            -- Word matches (individual keywords in title or description)
            (
              SELECT COALESCE(SUM(
                CASE 
                  WHEN LOWER(p.title) LIKE '%' || LOWER(kw) || '%' THEN 1000 
                  WHEN LOWER(p.description) LIKE '%' || LOWER(kw) || '%' THEN 10
                  ELSE 0 
                END
              ), 0)
              FROM unnest(?::text[]) AS kw
            ) +
            -- Variant SKU matches
            COALESCE((
              SELECT MAX(
                CASE 
                  WHEN LOWER(pv.sku) = ? THEN 500 
                  WHEN LOWER(pv.sku) LIKE '%' || ? || '%' THEN 50 
                  ELSE 0 
                END
              )
              FROM product_variant pv
              WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
            ), 0) +
            -- Category matches
            COALESCE((
              SELECT MAX(
                CASE 
                  WHEN LOWER(pc.name) = ? THEN 100 
                  WHEN LOWER(pc.name) LIKE '%' || ? || '%' THEN 10 
                  ELSE 0 
                END
              )
              FROM product_category_product pcp
              JOIN product_category pc ON pc.id = pcp.product_category_id
              WHERE pcp.product_id = p.id AND pc.deleted_at IS NULL
            ), 0)
          ) AS relevance
        FROM product p
        WHERE ${whereSql}
      )
      SELECT id, relevance
      FROM product_scoring
      WHERE relevance > 0
      ORDER BY relevance DESC, id ASC;
    `;

    const resultsRes = await db.raw(sql, sqlParams);
    const results = resultsRes.rows || [];

    const totalCount = results.length;
    const pageIds = results.slice(offset, offset + limit).map((r: any) => r.id);

    if (pageIds.length === 0) {
      req.query.id = ["prod_nonexistent_placeholder_id"];
    } else {
      req.query.id = pageIds;
    }

    delete req.query.q;

    const originalJson = res.json;
    res.json = function (body: any) {
      if (body && Array.isArray(body.products)) {
        const productMap = new Map<string, any>();
        body.products.forEach((p: any) => productMap.set(p.id, p));

        const sortedProducts = pageIds
          .map((id: string) => productMap.get(id))
          .filter(Boolean);

        body.products.forEach((p: any) => {
          if (!pageIds.includes(p.id)) {
            sortedProducts.push(p);
          }
        });

        body.products = sortedProducts;
        body.count = totalCount;
      }
      return originalJson.call(this, body);
    };

  } catch (err) {
    console.error("Error in adminProductSearchMiddleware:", err);
  }

  next();
}

async function protectProjectCategoryDeleteMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'DELETE') {
    const parts = req.path.split('/');
    const categoryId = parts[parts.length - 1];
    const projectParentId = process.env.PROJECT_PARENT_CATEGORY_ID;

    if (categoryId && projectParentId && categoryId === projectParentId) {
      return res.status(400).json({
        message: "The main projects category ('Unnamed') is critical for ordering workflows and cannot be deleted."
      });
    }
  }
  next();
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/enquiries",
      method: "POST",
      bodyParser: {
        sizeLimit: "20mb",
      },
    },
    {
      matcher: "/admin/product-categories/*",
      method: "DELETE",
      middlewares: [protectProjectCategoryDeleteMiddleware],
    },
    {
      matcher: "/admin/products",
      method: "GET",
      middlewares: [adminProductSearchMiddleware],
    },
    {
      matcher: "/admin/*",
      middlewares: [uppercaseCurrencyMiddleware],
    },
    {
      matcher: "/store/carts/*",
      method: "POST",
      middlewares: [validateCartAdditionMiddleware],
    },
  ],
})
