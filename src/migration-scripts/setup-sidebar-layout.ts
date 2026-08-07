import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function setupSidebarLayout({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const settingsService = container.resolve(Modules.SETTINGS)

  const config = {
    widgets: {
      "core:Searchbar": { hidden: true },
      "core:Divider": { hidden: true },
      "core:nav:/orders": { hidden: true },
      "core:nav:/inventory": { hidden: true },
      "core:nav:/promotions": { hidden: true },
      "core:nav:/price-lists": { hidden: true },
      "core:nav:/customer-groups": { hidden: true },
      "core:nav:/dashboard": { order: 0 },
      "core:nav:/products": { order: 1 },
      "core:nav:/order-management": { order: 2 },
      "core:nav:/inventory-management": { order: 3 },
      "core:nav:/customers": { order: 4 },
      "core:nav:/product-reviews": { order: 5 },
      "core:nav:/project-enquiries": { order: 6 },
      "core:nav:/website-settings": { order: 7 },
    },
  }

  await settingsService.setSystemDefaultLayoutConfiguration(
    "sidebar",
    config
  )

  logger.info("Sidebar layout configured.")
}
