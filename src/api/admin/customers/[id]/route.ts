import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { deleteCustomersWorkflow } from "@medusajs/core-flows"

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = req.params.id as string

  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const authService = req.scope.resolve(Modules.AUTH)

  let customer: any
  try {
    customer = await customerService.retrieveCustomer(id)
  } catch (error: any) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Customer with id: ${id} not found`
    )
  }

  // Capture the auth identities linked to this customer BEFORE running the
  // deletion workflow. Deleting the customer (even when it has placed orders)
  // also requires removing its login identity, otherwise re-registering the
  // same email later fails with an "email already exists" error.
  let authIdentities: any[] = []
  if (customer?.has_account) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "auth_identity",
        fields: ["id"],
        filters: { app_metadata: { customer_id: id } } as any,
      })
      authIdentities = data ?? []
    } catch (error: any) {
      console.warn(
        `Unable to lookup auth identities for customer ${id}:`,
        error
      )
    }
  }

  // Soft-delete the customer so historical orders/addresses remain intact but
  // the account disappears from the admin customers list.
  await deleteCustomersWorkflow(req.scope).run({
    input: { ids: [id] },
  })

  // Remove the auth identity (and its provider identities) entirely so the
  // email can be registered again with a fresh login.
  if (authIdentities.length) {
    const ids = authIdentities.map((ai: any) => ai.id)
    try {
      await authService.deleteAuthIdentities(ids)
    } catch (error: any) {
      console.warn(
        `Failed to hard-delete auth identities for customer ${id}, falling back to soft delete:`,
        error
      )
      await (authService as any).softDeleteAuthIdentities(ids)
    }
  }

  res.status(200).json({ id, object: "customer", deleted: true })
}