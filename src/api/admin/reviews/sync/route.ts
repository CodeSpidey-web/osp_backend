import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
const reviewsService = require("../../../../services/google-reviews-service");

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await reviewsService.syncAllLocations();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to sync Google reviews" });
  }
}
