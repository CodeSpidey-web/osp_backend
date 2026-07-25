import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
const reviewsService = require("../../../services/google-reviews-service");

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const locations = await reviewsService.getLocations();
    const reviewsData = await reviewsService.getReviews({
      rating: req.query.rating ? Number(req.query.rating) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 1000,
    });

    return res.json({
      locations,
      reviews: reviewsData.reviews,
      total: reviewsData.total,
      page: reviewsData.page,
      limit: reviewsData.limit,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch reviews" });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { action, locationName, placeId, locationUrl, reviewId, locationId } = req.body as any;

    if (action === "add_location") {
      if (!locationName || (!placeId && !locationUrl)) {
        return res.status(400).json({ error: "Location name and Place ID or URL are required" });
      }
      const newLoc = await reviewsService.addLocation({ locationName, placeId, locationUrl });
      return res.json({ location: newLoc });
    }

    if (action === "delete_location") {
      if (!locationId) return res.status(400).json({ error: "Location ID required" });
      await reviewsService.deleteLocation(locationId);
      return res.json({ success: true });
    }

    if (action === "delete_review") {
      if (!reviewId) return res.status(400).json({ error: "Review ID required" });
      await reviewsService.deleteReview(reviewId);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid action specified" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to process admin review action" });
  }
}
