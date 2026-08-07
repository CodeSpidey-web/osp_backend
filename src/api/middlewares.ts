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
  ],
})
