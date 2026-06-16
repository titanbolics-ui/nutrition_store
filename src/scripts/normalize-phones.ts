import { writeFileSync } from "fs"
import { resolve } from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import { normalizePhone } from "../utils/phone"

/**
 * One-off Stage 0 migration: bring every customer phone to E.164.
 *
 * Phase A — customers WITH a phone: normalize in place (defaultCountry =
 * shipping-address country of their most recent order). Unparseable phones
 * are left untouched and reported.
 * Phase B — guest customers WITHOUT a phone: backfill from the most recent
 * order's shipping-address phone (same guards as the order.placed subscriber:
 * guests only, never overwrites). Unparseable shipping phones are reported.
 *
 * Idempotent: E.164 is a fixed point of normalizePhone, backfill only fires
 * on empty phones — a second run produces zero changes.
 *
 * Report: phone-normalization-report.json in cwd, rewritten each run.
 * Contains PII (emails, raw phones) — gitignored, never commit it.
 *
 * Usage: npx medusa exec ./src/scripts/normalize-phones.ts
 */

export type CustomerPhoneInput = {
  customer_id: string
  email: string | null
  phone: string | null
  has_account: boolean
  // From the most recent order, when one exists:
  order_country: string | null
  order_shipping_phone: string | null
}

export type PhoneUpdate = { customer_id: string; phone: string }
export type ReportEntry = {
  customer_id: string
  email: string | null
  raw_phone: string
  reason: string
}

// Pure decision logic — unit-tested separately from DB access.
export function planPhoneNormalization(customers: CustomerPhoneInput[]): {
  updates: PhoneUpdate[]
  report: ReportEntry[]
} {
  const updates: PhoneUpdate[] = []
  const report: ReportEntry[] = []

  for (const c of customers) {
    if (c.phone) {
      // Phase A — normalize existing phone
      const normalized = normalizePhone(c.phone, c.order_country ?? undefined)
      if (normalized === null) {
        report.push({
          customer_id: c.customer_id,
          email: c.email,
          raw_phone: c.phone,
          reason: "unparseable",
        })
      } else if (normalized !== c.phone) {
        updates.push({ customer_id: c.customer_id, phone: normalized })
      }
    } else if (!c.has_account && c.order_shipping_phone) {
      // Phase B — backfill guests from the latest order's shipping phone
      const normalized = normalizePhone(
        c.order_shipping_phone,
        c.order_country ?? undefined
      )
      if (normalized === null) {
        report.push({
          customer_id: c.customer_id,
          email: c.email,
          raw_phone: c.order_shipping_phone,
          reason: "backfill_unparseable",
        })
      } else {
        updates.push({ customer_id: c.customer_id, phone: normalized })
      }
    }
  }

  return { updates, report }
}

export default async function normalizePhones({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerModuleSvc = container.resolve(
    Modules.CUSTOMER
  ) as ICustomerModuleService

  // Load all customers (paginated)
  const PAGE = 500
  const customers: {
    id: string
    email: string | null
    phone: string | null
    has_account: boolean
  }[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await customerModuleSvc.listCustomers(
      {},
      { select: ["id", "email", "phone", "has_account"], skip: offset, take: PAGE }
    )
    customers.push(...(page as any))
    if (page.length < PAGE) break
  }

  // Most recent order per customer (country + shipping phone)
  const inputs: CustomerPhoneInput[] = []
  for (const c of customers) {
    let order_country: string | null = null
    let order_shipping_phone: string | null = null
    // Only fetch the order when the decision needs it
    if (c.phone || !c.has_account) {
      const { data: orders } = await query.graph({
        entity: "order",
        filters: { customer_id: c.id },
        fields: [
          "id",
          "created_at",
          "shipping_address.country_code",
          "shipping_address.phone",
        ],
        pagination: { order: { created_at: "DESC" }, take: 1, skip: 0 },
      })
      const addr = (orders as any[])[0]?.shipping_address
      order_country = addr?.country_code ?? null
      order_shipping_phone = addr?.phone ?? null
    }
    inputs.push({
      customer_id: c.id,
      email: c.email,
      phone: c.phone,
      has_account: c.has_account,
      order_country,
      order_shipping_phone,
    })
  }

  const { updates, report } = planPhoneNormalization(inputs)

  for (const u of updates) {
    await customerModuleSvc.updateCustomers(u.customer_id, { phone: u.phone })
  }

  const reportPath = resolve(process.cwd(), "phone-normalization-report.json")
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  logger.info(
    `[normalize-phones] customers=${customers.length} updated=${updates.length} ` +
      `reported=${report.length} report=${reportPath}`
  )

  // medusa exec ignores the return value; integration tests assert on it
  return { updated: updates.length, reported: report.length }
}
