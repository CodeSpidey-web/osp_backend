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
    const exploreCategories = Array.isArray(metadata.explore_projects_categories) ? metadata.explore_projects_categories : []

    res.json({ explore_projects: exploreCategories })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving explore projects categories" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { explore_projects } = req.body as { explore_projects: Array<{ id: string; image_url: string }> }

  if (!Array.isArray(explore_projects)) {
    return res.status(400).json({ message: "explore_projects must be an array" })
  }

  if (explore_projects.length > 10) {
    return res.status(400).json({ message: "You can select a maximum of 10 categories for Explore Our Projects" })
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
      explore_projects_categories: explore_projects,
    }

    const metadataJson = JSON.stringify(updatedMetadata)

    await db.raw(
      `UPDATE store SET metadata = ?::jsonb WHERE id = ?`,
      [metadataJson, store.id]
    )

    res.json({ success: true, explore_projects })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred saving explore projects categories" })
  }
}
