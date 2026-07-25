import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
const reviewsService = require("../../../services/google-reviews-service");

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const data = await reviewsService.getReviews({
      status: "published",
      page: 1,
      limit: 1000,
    });
    return res.json({ reviews: data.reviews });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch store Google reviews" });
  }
}
