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
