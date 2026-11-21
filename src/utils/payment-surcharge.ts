import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ICartModuleService } from "@medusajs/types"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"

// PayPal surcharge: paying with PayPal costs PAYPAL_SURCHARGE_PERCENT more
// (base = items after discounts + delivery). Stored as an extra cart shipping
// method WITHOUT a shipping option — not a line item — so it lands in the cart
// total, payment collection and order total, but never in the items list or
// fulfillment status. Medusa drops option-less methods on any cart refresh, so
// a changed cart loses the surcharge together with its payment session.

export const PAYPAL_PROVIDER_ID = "pp_paypal-manual_paypal-manual"
export const SURCHARGE_METADATA_KEY = "payment_surcharge"

export type SurchargeQuote = {
  provider_id: string
  percent: number
  amount: number
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

// Missing, non-numeric or <= 0 → surcharge disabled.
export function getSurchargePercent(): number {
  const value = Number(process.env.PAYPAL_SURCHARGE_PERCENT)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function surchargeLabel(percent: number): string {
  return `PayPal fee (${percent}%)`
}

// Marker lives in `data` (part of the create DTO) and is mirrored to
// `metadata`; both are copied onto the order shipping method at checkout.
export function isSurchargeMethod(method: any): boolean {
  return !!(
    method?.data?.[SURCHARGE_METADATA_KEY] ||
    method?.metadata?.[SURCHARGE_METADATA_KEY]
  )
}

// Base = item total (after discounts) + delivery, excluding any existing surcharge.
export function computeSurcharge(cart: any, percent: number): number {
  if (!percent) return 0
  const surcharges = (cart?.shipping_methods ?? [])
    .filter(isSurchargeMethod)
    .reduce((sum: number, m: any) => sum + parseNum(m.amount), 0)
  const base =
    parseNum(cart?.item_total) + parseNum(cart?.shipping_total) - surcharges
  return Math.round(Math.max(0, base) * percent) / 100
}

// The provider of the cart's current payment session, if any.
export function activeProviderId(cart: any): string | null {
  const sessions = cart?.payment_collection?.payment_sessions ?? []
  return sessions[0]?.provider_id ?? null
}

export const SURCHARGE_CART_FIELDS = [
  "id",
  "item_total",
  "shipping_total",
  "shipping_methods.id",
  "shipping_methods.amount",
  "shipping_methods.data",
  "shipping_methods.metadata",
  "payment_collection.payment_sessions.provider_id",
]

async function loadCart(container: MedusaContainer, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [cart] } = await query.graph(
    { entity: "cart", filters: { id: cartId }, fields: SURCHARGE_CART_FIELDS },
    { throwIfKeyNotFound: true }
  )
  return cart as any
}

export async function quoteSurcharge(
  container: MedusaContainer,
  cartId: string
): Promise<SurchargeQuote> {
  const percent = getSurchargePercent()
  const cart = await loadCart(container, cartId)
  return {
    provider_id: PAYPAL_PROVIDER_ID,
    percent,
    amount: computeSurcharge(cart, percent),
  }
}

/**
 * Make the cart's surcharge match the chosen provider: PayPal → exactly one
 * surcharge method with the current amount; anything else / null → none.
 * Idempotent. Refreshes the payment collection so its amount follows the new
 * total — call it BEFORE creating the payment session.
 */
export async function syncPaymentSurcharge(
  container: MedusaContainer,
  cartId: string,
  providerId: string | null
): Promise<void> {
  const cartModule = container.resolve(Modules.CART) as ICartModuleService
  const cart = await loadCart(container, cartId)
  const percent = getSurchargePercent()

  const existing = (cart.shipping_methods ?? []).filter(isSurchargeMethod)
  const amount =
    providerId === PAYPAL_PROVIDER_ID ? computeSurcharge(cart, percent) : 0

  const upToDate =
    amount > 0
      ? existing.length === 1 && parseNum(existing[0].amount) === amount
      : existing.length === 0
  if (upToDate) return

  if (existing.length) {
    await cartModule.deleteShippingMethods(existing.map((m: any) => m.id))
  }
  if (amount > 0) {
    const marker = { [SURCHARGE_METADATA_KEY]: "paypal", percent }
    await cartModule.addShippingMethods({
      cart_id: cartId,
      name: surchargeLabel(percent),
      amount,
      data: marker,
      metadata: marker,
    } as any)
  }

  await refreshPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cartId },
  })
}

/**
 * Validate-time check: the stored surcharge must match what the active
 * payment session requires. Returns an error message or null.
 */
export async function checkSurchargeConsistency(
  container: MedusaContainer,
  cartId: string
): Promise<string | null> {
  const cart = await loadCart(container, cartId)
  const percent = getSurchargePercent()
  const existing = (cart.shipping_methods ?? []).filter(isSurchargeMethod)
  const stored = existing.reduce((s: number, m: any) => s + parseNum(m.amount), 0)
  const expected =
    activeProviderId(cart) === PAYPAL_PROVIDER_ID
      ? computeSurcharge(cart, percent)
      : 0

  const ok = existing.length <= 1 && Math.abs(stored - expected) < 0.005
  return ok ? null : "Payment total changed, please re-select your payment method."
}
