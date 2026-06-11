import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"

const ALWAYS_OK = { message: "If a matching order exists, an activation link has been sent." }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { order_view_token } = req.body as { order_view_token?: string }

  if (!order_view_token) return res.json(ALWAYS_OK)

  try {
    const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
    const notificationSvc = req.scope.resolve("notification") as any

    // Verify order_view token (multi-use, no consumption) — email comes from the DB record,
    // never from request body, to prevent token-forwarding attacks.
    const tokenRecord = await magicTokenSvc.verifyToken(order_view_token, "order_view")
    const { email, order_id: orderId } = tokenRecord

    const activateToken = await magicTokenSvc.generateToken({
      email,
      type: "activate",
      orderId,
    })

    await notificationSvc.createNotifications({
      to: email,
      channel: "email",
      template: "activate-confirm",
      data: { activateToken, email },
    })
  } catch (_) {
    // Swallow all errors — always return the same response
  }

  return res.json(ALWAYS_OK)
}
