import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const authContext = (req as any).auth_context
  const actorId = authContext?.actor_id

  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  try {
    const userModuleService = req.scope.resolve("user") as any
    const user = await userModuleService.retrieveUser(actorId)
    res.json({ email: user.email })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Error retrieving user profile" })
  }
}
