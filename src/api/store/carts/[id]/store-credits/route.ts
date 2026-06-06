import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteCartCreditLinesWorkflow,
  refreshCartItemsWorkflow,
} from "@medusajs/core-flows"

// DELETE /store/carts/:id/store-credits
// Removes all store-credit credit lines from the cart
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

  const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: ["id", "credit_lines.id", "credit_lines.reference"],
    filters: { id: cartId },
  }, { throwIfKeyNotFound: true })

  const lineIds: string[] = (cart.credit_lines ?? [])
    .filter((l: any) => l.reference === "store-credit")
    .map((l: any) => l.id)

  if (lineIds.length > 0) {
    await deleteCartCreditLinesWorkflow(req.scope).run({
      input: { id: lineIds },
    })
    await refreshCartItemsWorkflow(req.scope).run({
      input: { cart_id: cartId },
    })
  }

  res.status(200).json({ cart_id: cartId, deleted: lineIds.length })
}
