import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"
import { findRegisteredCustomer } from "../../../../../utils/magic-link-identity"

const ALWAYS_OK = { message: "If an account exists for this email, a login link has been sent." }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rawEmail = (req.body as any)?.email as string | undefined

  if (!rawEmail) return res.json(ALWAYS_OK)

  const email = rawEmail.trim().toLowerCase()

  try {
    const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
    const notificationSvc = req.scope.resolve("notification") as any

    // Only send a link if a registered customer exists — guest-only accounts have
    // nowhere to log in to, so sending a link would be confusing and misleading.
    const customer = await findRegisteredCustomer(req.scope, email)
    if (!customer) return res.json(ALWAYS_OK)

    const loginToken = await magicTokenSvc.generateToken({ email, type: "login" })

    await notificationSvc.createNotifications({
      to: email,
      channel: "email",
      template: "magic-link-login",
      data: { loginToken, email },
    })
  } catch (_) {
    // Swallow all errors — always return the same response
  }

  return res.json(ALWAYS_OK)
}
