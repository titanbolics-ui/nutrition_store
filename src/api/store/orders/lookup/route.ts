import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { matchOrder } from "./_match"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, display_id } = req.body as { email?: string; display_id?: string }

  if (!email || !display_id) {
    return res.status(400).json({ message: "email and display_id are required" })
  }

  const order = await matchOrder(email, display_id, req.scope)

  if (!order) {
    return res.json({ found: false })
  }

  // Extract tracking numbers from metadata (stored by our tracking route)
  const trackingMap = (order.metadata?.tracking ?? {}) as Record<string, string>
  const tracking_numbers = Object.values(trackingMap).filter(Boolean)

  return res.json({
    found: true,
    status: order.status,
    fulfillment_status: order.fulfillment_status,
    tracking_numbers,
    created_at: order.created_at,
  })
}
