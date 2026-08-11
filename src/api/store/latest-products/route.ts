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
