import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function printSidebarConfig({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const settingsService = container.resolve(Modules.SETTINGS)

  try {
    const layout = await settingsService.getSystemDefaultLayoutConfiguration("sidebar")
    logger.info("Sidebar Layout Configuration:\n" + JSON.stringify(layout, null, 2))
  } catch (error) {
    logger.error("Error reading sidebar config: " + error)
  }
}
