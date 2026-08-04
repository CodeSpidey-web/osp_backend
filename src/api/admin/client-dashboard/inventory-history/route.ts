import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDb } from "../db";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const db = await getDb(req)
    const logs = await db("inventory_history")
      .select("*")
      .orderBy("created_at", "desc")
    res.json({ logs })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred fetching inventory history logs" })
  }
}
