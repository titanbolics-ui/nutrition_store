import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
  OrderStatus,
} from "@medusajs/framework/utils"
import { ICustomerModuleService } from "@medusajs/types"
import { normalizePhone } from "./phone"

// Minimum order (item total after discounts, excluding shipping) for customers
// who already have at least one PAID order. The first order stays unrestricted
// so a new customer can test us on a small amount; unpaid/cancelled orders do
// not count — that customer has not trusted us with money yet.

export type OrderMinimumResult = {
  applies: boolean
  minimum: number
  subtotal: number
  remaining: number
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v) || 0
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("numeric_" in o) return parseFloat(String(o.numeric_)) || 0
    if ("value" in o)    return parseFloat(String(o.value)) || 0
  }
  return 0
}

// Missing, non-numeric or <= 0 → feature disabled.
export function getRepeatOrderMinimum(): number {
  const value = Number(process.env.REPEAT_ORDER_MINIMUM)
  return Number.isFinite(value) && value > 0 ? value : 0
}

// Same "paid" rule as sync-orders-to-sheets: any captured payment counts,
// so a partially paid order is still a paid one.
export function isPaidOrder(order: any): boolean {
  if (order?.status === OrderStatus.CANCELED) return false
  return (order?.payment_collections ?? []).some((pc: any) =>
    (pc?.payments ?? []).some((p: any) => !!p?.captured_at)
  )
}

/**
 * True when any customer record matching `emails` or `phones` owns a paid,
 * non-cancelled order. Matches across guest and registered records: every
 * guest checkout creates its own customer row, so customer_id alone is not
 * an identity. Guest phones are copied from the shipping address on
 * order.placed (Stage 0), so the phone lookup covers guests too.
 */
export async function hasPaidOrder(
  container: MedusaContainer,
  identity: { emails?: (string | null | undefined)[]; phones?: (string | null | undefined)[] }
): Promise<boolean> {
  const emails = new Set<string>()
  for (const raw of identity.emails ?? []) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    emails.add(trimmed)
    emails.add(trimmed.toLowerCase())
  }

  const phones = new Set<string>()
  for (const raw of identity.phones ?? []) {
    if (!raw?.trim()) continue
    const normalized = normalizePhone(raw)
    if (normalized) phones.add(normalized)
  }

  if (!emails.size && !phones.size) return false

  const customerModuleSvc = container.resolve(Modules.CUSTOMER) as ICustomerModuleService
  const customerIds = new Set<string>()

  if (emails.size) {
    const byEmail = await customerModuleSvc.listCustomers({ email: [...emails] })
    byEmail.forEach((c) => customerIds.add(c.id))
  }
  if (phones.size) {
    const byPhone = await customerModuleSvc.listCustomers({ phone: [...phones] } as any)
    byPhone.forEach((c) => customerIds.add(c.id))
  }

  if (!customerIds.size) return false

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { customer_id: [...customerIds] },
    fields: ["id", "status", "payment_collections.payments.captured_at"],
  })

  return (orders as any[]).some(isPaidOrder)
}

export async function evaluateOrderMinimum(
  container: MedusaContainer,
  cartId: string
): Promise<OrderMinimumResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [cart] } = await query.graph(
    {
      entity: "cart",
      filters: { id: cartId },
      fields: [
        "id",
        "email",
        "item_total",
        "shipping_address.phone",
        "shipping_address.country_code",
        "customer.email",
        "customer.phone",
      ],
    },
    { throwIfKeyNotFound: true }
  )

  const minimum = getRepeatOrderMinimum()
  const subtotal = parseNum((cart as any).item_total)

  if (!minimum) {
    return { applies: false, minimum: 0, subtotal, remaining: 0 }
  }

  // Checkout phones are often typed without "+1" — resolve them with the
  // shipping country, the same way order.placed stores them on the customer.
  const shipping = (cart as any).shipping_address
  const shippingPhone = shipping?.phone
    ? normalizePhone(shipping.phone, shipping.country_code) ?? shipping.phone
    : null

  const applies = await hasPaidOrder(container, {
    emails: [cart.email, (cart as any).customer?.email],
    phones: [shippingPhone, (cart as any).customer?.phone],
  })

  // Cents rounding so $149.995 float noise never blocks a $150 cart.
  const remaining = applies
    ? Math.max(0, Math.round((minimum - subtotal) * 100) / 100)
    : 0

  return { applies, minimum, subtotal, remaining }
}
