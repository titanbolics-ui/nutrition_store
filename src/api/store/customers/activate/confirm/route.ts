import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, generateJwtToken, Modules } from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"
import {
  findOrCreateMagicLinkIdentity,
  buildAuthContext,
  issueSession,
} from "../../../../../utils/magic-link-identity"
import { claimGuestOrders } from "../../../../../utils/claim-guest-orders"
import { normalizePhone } from "../../../../../utils/phone"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { token } = req.body as { token?: string }

  if (!token) {
    return res.status(400).json({ message: "Token is required" })
  }

  const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
  const customerModuleSvc = req.scope.resolve(Modules.CUSTOMER) as ICustomerModuleService
  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve("logger") as any

  // 1. Verify single-use activate token — email comes from the DB record
  let tokenRecord: any
  try {
    tokenRecord = await magicTokenSvc.verifyToken(token, "activate")
  } catch (_) {
    return res.status(400).json({ message: "Invalid or expired activation token" })
  }

  const { email, payload } = tokenRecord

  // 2. Find or create registered customer (idempotent).
  // payload is ONLY applied when creating a new customer — never overwrites an existing account.
  const [existingCustomer] = await customerModuleSvc.listCustomers({
    email,
    has_account: true,
  })

  let customer: any
  if (existingCustomer) {
    customer = existingCustomer
  } else {
    // Profile source chain, per field: token payload (registration form) →
    // guest customer records (newest first — latest order wins) → shipping
    // address of the most recent order. Only non-empty values are taken, so
    // an empty phone on a newer order never shadows a filled one on an older.
    const guestCustomers = (
      await customerModuleSvc.listCustomers({ email, has_account: false })
    ).sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    let latestShippingAddress: any = null
    const guestIds = guestCustomers.map((g: any) => g.id)
    if (guestIds.length) {
      const { data: recentOrders } = await query.graph({
        entity: "order",
        filters: { customer_id: guestIds },
        fields: ["id", "created_at", "shipping_address.*"],
        pagination: { order: { created_at: "DESC" }, take: 1, skip: 0 },
      })
      latestShippingAddress = (recentOrders as any[])[0]?.shipping_address ?? null
    }

    const pick = (field: "first_name" | "last_name" | "phone"): string | undefined => {
      const fromPayload = payload?.[field]
      if (fromPayload) return String(fromPayload)
      for (const g of guestCustomers) {
        if (g[field]) return String(g[field])
      }
      if (latestShippingAddress?.[field]) return String(latestShippingAddress[field])
      return undefined
    }

    const first_name = pick("first_name")
    const last_name  = pick("last_name")
    const rawPhone   = pick("phone")

    customer = await customerModuleSvc.createCustomers({
      email,
      has_account: true,
      ...(first_name ? { first_name } : {}),
      ...(last_name  ? { last_name }  : {}),
      ...(rawPhone   ? { phone: normalizePhone(rawPhone) } : {}),
    })

    // Seed the address book from the latest order — next checkout is prefilled
    if (latestShippingAddress?.address_1) {
      try {
        await (customerModuleSvc as any).createCustomerAddresses({
          customer_id: customer.id,
          first_name: latestShippingAddress.first_name ?? first_name ?? undefined,
          last_name: latestShippingAddress.last_name ?? last_name ?? undefined,
          address_1: latestShippingAddress.address_1,
          address_2: latestShippingAddress.address_2 ?? undefined,
          city: latestShippingAddress.city ?? undefined,
          postal_code: latestShippingAddress.postal_code ?? undefined,
          province: latestShippingAddress.province ?? undefined,
          country_code: latestShippingAddress.country_code ?? undefined,
          phone: latestShippingAddress.phone
            ? normalizePhone(String(latestShippingAddress.phone))
            : undefined,
          is_default_shipping: true,
        })
      } catch (err: any) {
        logger.warn(`[activate/confirm] Failed to seed address book: ${err?.message}`)
      }
    }
  }

  // 3. Find-or-create magic-link auth identity (idempotent — won't duplicate on re-activation)
  const authIdentity = await findOrCreateMagicLinkIdentity(req.scope, email, customer.id)

  // 4. Issue session + generate JWT for Bearer auth
  const authContext = buildAuthContext(customer.id, authIdentity.id)
  await issueSession(req, authContext)

  const { http: { jwtSecret, jwtExpiresIn } = {} as any } = configModule.projectConfig
  const jwtToken = generateJwtToken(authContext, {
    secret: jwtSecret || process.env.JWT_SECRET || "supersecret",
    expiresIn: jwtExpiresIn || "7d",
  })

  // 5. Transfer all guest orders to the now-verified account
  await claimGuestOrders(req.scope, email, customer.id)

  return res.json({
    token: jwtToken,
    customer: { id: customer.id, email: customer.email },
  })
}
