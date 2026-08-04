import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /store/reviews?product_id=...
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any
  const productId = req.query.product_id as string

  if (!productId) {
    return res.status(400).json({ message: "product_id query parameter is required" })
  }

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

    // 2. Fetch reviews associated with the product ID, ordered by date desc
    const reviewsRes = await db.raw(
      "SELECT id, product_id, author, rating, title, content, verified, created_at FROM product_review WHERE product_id = ? ORDER BY created_at DESC",
      [productId]
    )

    res.json({ reviews: reviewsRes.rows })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving reviews" })
  }
}

// POST /store/reviews
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any
  const customerModuleService = req.scope.resolve("customer") as any
  const customerId = (req as any).auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({ message: "You must be logged in to submit a review." })
  }

  const { product_id, rating, title, content } = req.body as {
    product_id: string
    rating: number
    title: string
    content: string
  }

  if (!product_id || !rating || !title || !content) {
    return res.status(400).json({ message: "Missing required fields (product_id, rating, title, content)" })
  }

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

    // 2. Retrieve the logged-in customer's details
    const customer = await customerModuleService.retrieveCustomer(customerId)
    const authorName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email || 'Anonymous User'

    // 3. Insert review
    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    await db.raw(`
      INSERT INTO product_review (id, product_id, author, rating, title, content, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      reviewId,
      product_id,
      authorName,
      Number(rating),
      title,
      content,
      true // Verified purchase because they are authenticated members
    ])

    // 4. Fetch the updated list of reviews to return to the caller
    const reviewsRes = await db.raw(
      "SELECT id, product_id, author, rating, title, content, verified, created_at FROM product_review WHERE product_id = ? ORDER BY created_at DESC",
      [product_id]
    )

    res.json({ success: true, reviews: reviewsRes.rows })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred saving your review" })
  }
}
