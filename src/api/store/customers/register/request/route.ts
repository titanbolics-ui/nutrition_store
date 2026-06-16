import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import { z } from "zod"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"
import { normalizePhone } from "../../../../../utils/phone"

const ALWAYS_OK = { message: "If this email is new, a confirmation link has been sent." }

const schema = z.object({
  email:      z.string().email().max(254),
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name:  z.string().trim().min(1).max(100).optional(),
  phone:      z.string().trim().max(30).optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.json(ALWAYS_OK)

  const { email: rawEmail, first_name, last_name, phone } = parsed.data

  try {
    const email = rawEmail.trim().toLowerCase()
    const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
    const customerModuleSvc = req.scope.resolve(Modules.CUSTOMER) as ICustomerModuleService
    const notificationSvc = req.scope.resolve("notification") as any

    const [existingCustomer] = await customerModuleSvc.listCustomers({
      email,
      has_account: true,
    })

    if (existingCustomer) {
      const loginToken = await magicTokenSvc.generateToken({ email, type: "login" })
      await notificationSvc.createNotifications({
        to: email,
        channel: "email",
        template: "magic-link-login",
        data: { loginToken, email },
      })
    } else {
      const payload: Record<string, unknown> = {}
      if (first_name) payload.first_name = first_name
      if (last_name)  payload.last_name  = last_name
      if (phone)      payload.phone      = normalizePhone(phone) ?? phone

      const activateToken = await magicTokenSvc.generateToken({
        email,
        type: "activate",
        payload,
      })

      await notificationSvc.createNotifications({
        to: email,
        channel: "email",
        template: "register-confirm",
        data: { activateToken, email, first_name: payload.first_name ?? "" },
      })
    }
  } catch (_) {
    // Swallow — always same response
  }

  return res.json(ALWAYS_OK)
}
