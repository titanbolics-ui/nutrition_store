import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, generateJwtToken } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"
import {
  findOrCreateMagicLinkIdentity,
  buildAuthContext,
  issueSession,
  findRegisteredCustomer,
} from "../../../../../utils/magic-link-identity"
import { claimGuestOrders } from "../../../../../utils/claim-guest-orders"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { token } = req.body as { token?: string }

  if (!token) {
    return res.status(400).json({ message: "Token is required" })
  }

  const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any

  // 1. Verify single-use login token → get email
  let tokenRecord: any
  try {
    tokenRecord = await magicTokenSvc.verifyToken(token, "login")
  } catch (_) {
    return res.status(400).json({ message: "Invalid or expired login token" })
  }

  const { email } = tokenRecord

  // 2. Find registered customer — login is only valid for accounts that exist.
  //    Old emailpass customers are handled here: they have has_account = true but
  //    no magic-link identity yet. findOrCreateMagicLinkIdentity handles that below.
  const customer = await findRegisteredCustomer(req.scope, email)
  if (!customer) {
    return res.status(400).json({ message: "No registered account found for this email" })
  }

  // 3. Find-or-create magic-link identity.
  //    Covers three cases:
  //    a) New account activated via magic link → identity already exists, reuse it
  //    b) Old emailpass customer, first magic-link login → create identity now
  //    c) Re-login after identity exists → reuse it
  const authIdentity = await findOrCreateMagicLinkIdentity(req.scope, email, customer.id)

  // 4. Issue session + JWT (same shape as emailpass login response)
  const authContext = buildAuthContext(customer.id, authIdentity.id)
  await issueSession(req, authContext)

  const { http: { jwtSecret, jwtExpiresIn } = {} as any } = configModule.projectConfig
  const jwtToken = generateJwtToken(authContext, {
    secret: jwtSecret || process.env.JWT_SECRET || "supersecret",
    expiresIn: jwtExpiresIn || "7d",
  })

  // 5. Claim guest orders on every login, not just activation — covers
  //    registration onto an email with guest orders (login email path) and
  //    guest checkouts made after the account already existed. Idempotent.
  await claimGuestOrders(req.scope, email, customer.id)

  return res.json({
    token: jwtToken,
    customer: { id: customer.id, email: customer.email },
  })
}
