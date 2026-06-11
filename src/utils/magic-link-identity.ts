import { IAuthModuleService, ICustomerModuleService } from "@medusajs/types"
import { Modules } from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework"

export type AuthIdentityResult = {
  id: string
  app_metadata: Record<string, unknown>
}

/**
 * Find-or-create an auth identity for `provider: "magic-link"` + this email.
 * - If one already exists → return it (updates app_metadata.customer_id if stale)
 * - If none → create a new one
 *
 * Called from both activate/confirm and magic-link/exchange so old emailpass
 * customers get a magic-link identity on first magic-link login.
 */
export async function findOrCreateMagicLinkIdentity(
  container: MedusaContainer,
  email: string,
  customerId: string
): Promise<AuthIdentityResult> {
  const authModuleSvc = container.resolve(Modules.AUTH) as IAuthModuleService

  const [providerIdentity] = await (authModuleSvc as any).listProviderIdentities(
    { provider: "magic-link", entity_id: email },
    { relations: ["auth_identity"] }
  )

  if (providerIdentity?.auth_identity) {
    const existing = providerIdentity.auth_identity as AuthIdentityResult
    // Patch stale customer_id (e.g. customer was recreated)
    if (existing.app_metadata?.customer_id !== customerId) {
      const [updated] = await (authModuleSvc as any).updateAuthIdentities([{
        id: existing.id,
        app_metadata: { ...existing.app_metadata, customer_id: customerId },
      }])
      return updated as AuthIdentityResult
    }
    return existing
  }

  const created = await (authModuleSvc as any).createAuthIdentities({
    app_metadata: { customer_id: customerId },
    provider_identities: [{ provider: "magic-link", entity_id: email }],
  })
  return created as AuthIdentityResult
}

/**
 * Build the auth_context object that express-session and Medusa's authenticate
 * middleware both understand. Shape mirrors what `GET /auth/session` reads from
 * `req.session.auth_context`.
 */
export function buildAuthContext(customerId: string, authIdentityId: string) {
  return {
    actor_id: customerId,
    actor_type: "customer",
    auth_identity_id: authIdentityId,
    app_metadata: { customer_id: customerId },
    user_metadata: {},
  }
}

/**
 * Issue a session by setting req.session.auth_context + saving the session
 * so the Set-Cookie header is included in the response.
 */
export async function issueSession(req: any, authContext: ReturnType<typeof buildAuthContext>) {
  req.session.auth_context = authContext
  await new Promise<void>((resolve, reject) =>
    req.session.save((err: unknown) => (err ? reject(err) : resolve()))
  )
}

/**
 * Find a registered customer by normalised email. Returns null if none.
 */
export async function findRegisteredCustomer(
  container: MedusaContainer,
  rawEmail: string
) {
  const email = rawEmail.trim().toLowerCase()
  const customerModuleSvc = container.resolve(Modules.CUSTOMER) as ICustomerModuleService
  const [customer] = await customerModuleSvc.listCustomers({ email, has_account: true })
  return customer ?? null
}
