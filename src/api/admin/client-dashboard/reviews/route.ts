import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/client-dashboard/reviews
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any

  try {
    // 1. Ensure table exists dynamically in PostgreSQL
    await db.raw(`
      CREATE TABLE IF NOT EXISTS product_review (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        rating INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 2. Fetch all reviews with product title from DB
    const reviewsRes = await db.raw(`
      SELECT pr.id, pr.product_id, pr.author, pr.rating, pr.title, pr.content, pr.verified, pr.created_at, p.title as product_title
      FROM product_review pr
      LEFT JOIN product p ON pr.product_id = p.id
      ORDER BY pr.created_at DESC
    `)

    res.json({ reviews: reviewsRes.rows })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving reviews" })
  }
}

// DELETE /admin/client-dashboard/reviews?id=...
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any
  const id = req.query.id as string

  if (!id) {
    return res.status(400).json({ message: "Review ID is required" })
  }

  try {
    // Delete review
    await db.raw("DELETE FROM product_review WHERE id = ?", [id])
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred deleting review" })
  }
}
