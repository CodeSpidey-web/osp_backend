import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ModuleRegistrationName } from "@medusajs/framework/utils";

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
  const productModuleService = req.scope.resolve(ModuleRegistrationName.PRODUCT) as any

  try {
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "metadata"],
    })
    const store = stores[0]
    const metadata = parseMetadata(store?.metadata)
    const exploreCategories: Array<{ id: string; image_url: string }> = Array.isArray(metadata.explore_projects_categories) 
      ? metadata.explore_projects_categories 
      : []

    if (exploreCategories.length === 0) {
      return res.json({ explore_projects: [] })
    }

    const categoryIds = exploreCategories.map((c) => c.id)

    // Fetch category names & handles
    const categories = await productModuleService.listProductCategories(
      { id: categoryIds },
      { select: ["id", "name", "handle"] }
    )

    const categoryMap = new Map(categories.map((c: any) => [c.id, c]))
    const resolvedExploreCategories = exploreCategories
      .map((c) => {
        const catDetails = categoryMap.get(c.id) as any
        if (!catDetails) return null
        return {
          id: c.id,
          name: catDetails.name,
          handle: catDetails.handle,
          image_url: c.image_url,
        }
      })
      .filter(Boolean)

    res.json({ explore_projects: resolvedExploreCategories })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving explore projects categories" })
  }
}
