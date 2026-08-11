import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

function parseMetadata(raw: any): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {} } catch { return {} }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw
  return {}
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")

  try {
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "metadata"],
    })
    const store = stores[0]
    const metadata = parseMetadata(store?.metadata)
    const popularCategories = Array.isArray(metadata.popular_categories) ? metadata.popular_categories : []

    res.json({ popular_categories: popularCategories })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving popular categories" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { popular_categories } = req.body as { popular_categories: Array<{ id: string; image_url: string }> }

  if (!Array.isArray(popular_categories)) {
    return res.status(400).json({ message: "popular_categories must be an array" })
  }

  if (popular_categories.length > 20) {
    return res.status(400).json({ message: "You can select a maximum of 20 categories as popular categories" })
  }

  const query = req.scope.resolve("query")
  const db = req.scope.resolve("__pg_connection__") as any

  try {
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "metadata"],
    })
    const store = stores[0]
    const existingMeta = parseMetadata(store?.metadata)

    const updatedMetadata = {
      ...existingMeta,
      popular_categories,
    }

    const metadataJson = JSON.stringify(updatedMetadata)

    await db.raw(
      `UPDATE store SET metadata = ?::jsonb WHERE id = ?`,
      [metadataJson, store.id]
    )

    res.json({ success: true, popular_categories })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred saving popular categories" })
  }
}
