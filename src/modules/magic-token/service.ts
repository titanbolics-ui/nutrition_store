import { MedusaService, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MagicToken } from "./models/magic-token"
import { createHash, randomBytes } from "crypto"

type TokenType = "order_view" | "login" | "activate"

const TTL_MS: Record<TokenType, number> = {
  order_view: 30 * 24 * 60 * 60 * 1000,
  login:      15 * 60 * 1000,
  activate:   15 * 60 * 1000,
}

class MagicTokenModuleService extends MedusaService({ MagicToken }) {
  private pg_: any  // Knex connection

  constructor(container: Record<string, any>) {
    super(...arguments as any)
    this.pg_ = container[ContainerRegistrationKeys.PG_CONNECTION]
  }

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex")
  }

  async generateToken(opts: {
    email: string
    type: TokenType
    orderId?: string
    payload?: Record<string, unknown>
  }): Promise<string> {
    const { email, type, orderId, payload } = opts

    if (type === "login" || type === "activate") {
      const since = new Date(Date.now() - 60 * 60 * 1000)
      const recent = await this.listMagicTokens({
        email,
        type,
        created_at: { $gte: since },
      } as any)
      if (recent.length >= 5) {
        throw new Error("Too many requests. Please wait before requesting another link.")
      }
    }

    const raw = randomBytes(32).toString("base64url")
    await this.createMagicTokens([{
      token_hash: this.hash(raw),
      email,
      type,
      order_id: orderId ?? null,
      expires_at: new Date(Date.now() + TTL_MS[type]),
      used_at: null,
      payload: payload ?? null,
    }])

    return raw
  }

  async verifyToken(raw: string, type: TokenType): Promise<{ email: string; orderId: string | null; payload: Record<string, unknown> | null }> {
    const tokenHash = this.hash(raw)

    const [token] = await this.listMagicTokens({ token_hash: tokenHash, type } as any)

    if (!token) throw new Error("Invalid or expired link.")
    if (new Date(token.expires_at) < new Date()) throw new Error("Link has expired.")

    if (type === "login" || type === "activate") {
      if (token.used_at) throw new Error("Link has already been used.")

      // Atomic: UPDATE WHERE used_at IS NULL — prevents TOCTOU double-use
      const result = await this.pg_("magic_token")
        .where({ id: token.id })
        .whereNull("used_at")
        .update({ used_at: new Date() })

      // result is the count of affected rows in Knex
      if (result === 0) throw new Error("Link has already been used.")
    }

    return { email: token.email, orderId: token.order_id ?? null, payload: token.payload ?? null }
  }

  async hardDeleteExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return await this.pg_("magic_token").where("expires_at", "<", cutoff).delete()
  }
}

export default MagicTokenModuleService
