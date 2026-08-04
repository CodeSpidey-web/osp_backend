import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const expressApp = (req as any).app;
  const routes: string[] = [];

  function print(path: any, layer: any) {
    if (layer.route) {
      layer.route.stack.forEach((stackItem: any) => {
        const method = stackItem.method.toUpperCase();
        routes.push(`${method} ${path}`);
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach((stackItem: any) => {
        print(path + (layer.regexp.source.includes('^\\/?$') ? '' : layer.regexp.source), stackItem);
      });
    }
  }

  // Medusa's router is nested. Let's dump all paths registered in expressApp
  if (expressApp && expressApp._router && expressApp._router.stack) {
    expressApp._router.stack.forEach((layer: any) => {
      if (layer.route) {
        const method = layer.route.stack[0].method.toUpperCase();
        routes.push(`${method} ${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        layer.handle.stack.forEach((stackItem: any) => {
          // Simplistic extraction of path
          let path = '';
          if (layer.regexp) {
            // Convert regexp to path approximation
            path = layer.regexp.source
              .replace('\\/?$', '')
              .replace('^\\/', '/')
              .replace('\\/', '/')
              .replace('(?=\\/|$)', '');
          }
          if (stackItem.route) {
            const method = stackItem.route.stack[0].method.toUpperCase();
            routes.push(`${method} ${path}${stackItem.route.path}`);
          } else if (stackItem.name === 'router') {
            // Recursively resolve
            stackItem.handle.stack?.forEach((subItem: any) => {
              if (subItem.route) {
                const method = subItem.route.stack[0].method.toUpperCase();
                routes.push(`${method} ${path}/${subItem.route.path}`);
              }
            });
          }
        });
      }
    });
  }

  // Alternative way: get paths from Medusa container if possible, or just list standard ones
  res.json({
    totalRoutesCount: routes.length,
    routes: routes.filter(r => r.includes('auth') || r.includes('customer'))
  });
}
