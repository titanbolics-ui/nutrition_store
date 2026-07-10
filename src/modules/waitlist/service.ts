import { MedusaService, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Waitlist } from "./models/waitlist"

const MAX_ACTIVE_PER_EMAIL = 5
const HARD_DELETE_AFTER_MS = 90 * 24 * 60 * 60 * 1000

class WaitlistModuleService extends MedusaService({ Waitlist }) {
  private pg_: any // Knex connection

  constructor(container: Record<string, any>) {
    super(...arguments as any)
    this.pg_ = container[ContainerRegistrationKeys.PG_CONNECTION]
  }

  async signUp(opts: {
    productId: string
    variantId: string
    email: string
    marketingConsent: boolean
  }): Promise<{ row: any; isNew: boolean }> {
    const { productId, variantId, email, marketingConsent } = opts

    const [existing] = await this.listWaitlists({ email, variant_id: variantId } as any)
    if (existing) {
      return { row: existing, isNew: false }
    }

    const active = await this.listWaitlists({ email, notified_at: null } as any)
    if (active.length >= MAX_ACTIVE_PER_EMAIL) {
      throw new Error(
        `You already have ${MAX_ACTIVE_PER_EMAIL} active waitlist signups. Please wait for one to be fulfilled before joining another.`
      )
    }

    const row = await this.createWaitlists({
      product_id: productId,
      variant_id: variantId,
      email,
      marketing_consent: marketingConsent,
      resend_contact_id: null,
      notified_at: null,
    })

    return { row, isNew: true }
  }

  async setResendContactId(id: string, contactId: string): Promise<void> {
    await this.pg_("waitlist").where({ id }).update({ resend_contact_id: contactId })
  }

  async listRetryable(): Promise<any[]> {
    return await this.listWaitlists({
      marketing_consent: true,
      resend_contact_id: null,
    } as any)
  }

  async countsByVariant(): Promise<
    { product_id: string; variant_id: string; total: number; active: number }[]
  > {
    const rows = await this.pg_("waitlist")
      .whereNull("deleted_at")
      .select("product_id", "variant_id")
      .count("* as total")
      .count({ active: this.pg_.raw("case when notified_at is null then 1 end") })
      .groupBy("product_id", "variant_id")
      .orderBy("active", "desc")

    return rows.map((r: any) => ({
      product_id: r.product_id,
      variant_id: r.variant_id,
      total: Number(r.total),
      active: Number(r.active),
    }))
  }

  async hardDeleteStale(): Promise<number> {
    const cutoff = new Date(Date.now() - HARD_DELETE_AFTER_MS)
    return await this.pg_("waitlist")
      .whereNotNull("notified_at")
      .where("notified_at", "<", cutoff)
      .delete()
  }
}

export default WaitlistModuleService
