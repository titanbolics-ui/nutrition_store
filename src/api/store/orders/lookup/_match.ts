import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type MatchedOrder = {
  id: string
  display_id: number
  email: string
  status: string
  fulfillment_status: string
  created_at: string
  metadata: Record<string, any> | null
}

export async function matchOrder(
  rawEmail: string,
  rawDisplayId: string,
  scope: any
): Promise<MatchedOrder | null> {
  const email = rawEmail.trim().toLowerCase()
  // Strip any non-numeric prefix (e.g. "ONX-1234" → 1234)
  const numStr = rawDisplayId.trim().replace(/^[^0-9]+/, "")
  const displayId = parseInt(numStr, 10)

  if (!email || isNaN(displayId)) return null

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "status", "fulfillment_status", "created_at", "metadata"],
    filters: { display_id: displayId },
  })

  const order = orders[0]
  if (!order) return null
  if (order.email.trim().toLowerCase() !== email) return null

  return order as MatchedOrder
}
