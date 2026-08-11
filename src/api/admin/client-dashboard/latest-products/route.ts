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
    const productIds: string[] = Array.isArray(metadata.latest_products) ? metadata.latest_products : []

    if (productIds.length === 0) {
      return res.json({ products: [] })
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "description",
        "thumbnail",
        "images.id",
        "images.url",
        "categories.id",
        "categories.name",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.prices.id",
        "variants.prices.amount",
        "variants.prices.currency_code",
      ],
      filters: {
        id: productIds,
      },
    })

    const idMap = new Map(products.map((p: any) => [p.id, p]))
    const sortedProducts = productIds.map((id) => idMap.get(id)).filter(Boolean)

    res.json({ products: sortedProducts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving latest products" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { product_ids } = req.body as { product_ids: string[] }

  if (!Array.isArray(product_ids)) {
    return res.status(400).json({ message: "product_ids must be an array" })
  }

  if (product_ids.length > 10) {
    return res.status(400).json({ message: "You can select a maximum of 10 products as latest products" })
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
      latest_products: product_ids,
    }

    const metadataJson = JSON.stringify(updatedMetadata)

    await db.raw(
      `UPDATE store SET metadata = ?::jsonb WHERE id = ?`,
      [metadataJson, store.id]
    )

    res.json({ success: true, product_ids })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred saving latest products" })
  }
}
