import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: fulfillmentId } = req.params
  const { tracking_number } = req.body as { tracking_number: string }

  if (!tracking_number?.trim()) {
    return res.status(400).json({ message: "tracking_number is required" })
  }

  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const orderService = req.scope.resolve(Modules.ORDER)

  // Find the order linked to this fulfillment
  const fulfillmentResult = await remoteQuery({
    entryPoint: "fulfillment",
    fields: ["id", "order.id", "order.metadata"],
    variables: { id: fulfillmentId },
  })

  const fulfillment = Array.isArray(fulfillmentResult)
    ? fulfillmentResult[0]
    : fulfillmentResult

  const orderId = fulfillment?.order?.id
  if (!orderId) {
    return res.status(404).json({ message: "Order not found for this fulfillment" })
  }

  // Merge new tracking number into existing metadata
  const existingMeta = (fulfillment.order.metadata ?? {}) as Record<string, any>
  const existingTracking = (existingMeta.tracking ?? {}) as Record<string, string>

  await orderService.updateOrders([{
    id: orderId,
    metadata: {
      ...existingMeta,
      tracking: {
        ...existingTracking,
        [fulfillmentId]: tracking_number.trim(),
      },
    },
  }])

  return res.status(200).json({
    fulfillment_id: fulfillmentId,
    tracking_number: tracking_number.trim(),
  })
}
