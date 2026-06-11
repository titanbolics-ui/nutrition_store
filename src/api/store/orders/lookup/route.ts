import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { matchOrder } from "./_match"
import { buildTrackingUrl } from "../../../../utils/tracking"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, display_id } = req.body as { email?: string; display_id?: string }

  if (!email || !display_id) {
    return res.status(400).json({ message: "email and display_id are required" })
  }

  const order = await matchOrder(email, display_id, req.scope)

  if (!order) {
    return res.json({ found: false })
  }

  // Fulfillments are the real status source — order.status stays "pending"
  // in Medusa until the order is completed
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "fulfillments.id", "fulfillments.shipped_at", "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
    ],
    filters: { id: order.id },
  })

  const fulfillments = (orders[0]?.fulfillments ?? []).filter(
    (f: any) => f && !f.canceled_at
  )

  let status: string = order.status
  if (status === "pending" && fulfillments.length > 0) {
    const shippedOrDelivered = (f: any) => f.shipped_at || f.delivered_at
    if (fulfillments.every((f: any) => f.delivered_at)) status = "delivered"
    else if (fulfillments.some((f: any) => f.delivered_at)) status = "partially delivered"
    else if (fulfillments.every(shippedOrDelivered)) status = "shipped"
    else if (fulfillments.some(shippedOrDelivered)) status = "partially shipped"
    else status = "processing"
  }

  const tracking_links = fulfillments
    .flatMap((f: any) => f.labels ?? [])
    .filter((l: any) => l?.tracking_number)
    .map((l: any) => ({
      tracking_number: l.tracking_number,
      url: buildTrackingUrl(l.tracking_number, l.tracking_url),
    }))

  // Legacy source: tracking numbers stored in order metadata by the tracking route
  const trackingMap = (order.metadata?.tracking ?? {}) as Record<string, string>
  for (const tn of Object.values(trackingMap).filter(Boolean)) {
    if (!tracking_links.some((t: any) => t.tracking_number === tn)) {
      tracking_links.push({ tracking_number: tn, url: buildTrackingUrl(tn) })
    }
  }

  return res.json({
    found: true,
    status,
    fulfillment_status: order.fulfillment_status,
    tracking_links,
    tracking_numbers: tracking_links.map((t: any) => t.tracking_number),
    created_at: order.created_at,
  })
}
