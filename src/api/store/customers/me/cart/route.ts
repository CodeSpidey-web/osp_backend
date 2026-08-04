import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  let customerId = (req as any).auth_user?.app_metadata?.customer_id;
  if (!customerId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        customerId = payload.app_metadata?.customer_id || payload.customer_id || payload.actor_id;
      } catch (e) {
        console.error("Failed to decode token in custom cart endpoint:", e);
      }
    }
  }

  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = req.scope.resolve("__pg_connection__") as any;
  try {
    const cartResult = await db.raw(`
      SELECT id 
      FROM cart 
      WHERE customer_id = ? AND completed_at IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [customerId]);

    if (cartResult && cartResult.rows && cartResult.rows.length > 0) {
      return res.json({ cart_id: cartResult.rows[0].id });
    }
    return res.json({ cart_id: null });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
