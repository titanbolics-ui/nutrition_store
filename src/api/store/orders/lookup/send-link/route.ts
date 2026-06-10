import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { matchOrder } from "../_match"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"

const ALWAYS_OK = { message: "If a matching order exists, a link has been sent to the email." }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, display_id } = req.body as { email?: string; display_id?: string }

  if (!email || !display_id) {
    return res.status(400).json({ message: "email and display_id are required" })
  }

  const order = await matchOrder(email, display_id, req.scope)

  if (!order) {
    return res.json(ALWAYS_OK)
  }

  try {
    const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
    const notificationSvc = req.scope.resolve("notification") as any

    const orderViewToken = await magicTokenSvc.generateToken({
      email: order.email,
      type: "order_view",
      orderId: order.id,
    })

    await notificationSvc.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-view-link",
      data: {
        order: { id: order.id, display_id: order.display_id, email: order.email },
        orderViewToken,
      },
    })
  } catch {
    // Swallow errors — never reveal whether match succeeded
  }

  return res.json(ALWAYS_OK)
}
