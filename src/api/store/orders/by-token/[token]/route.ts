import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"
import { buildTrackingUrl } from "../../../../../utils/tracking"

// query.graph returns Medusa BigNumber objects ({ numeric_: ... }) for amounts —
// they serialize to JSON as objects, breaking Number() math on the frontend
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

function maskAddress(addr: any): any {
  if (!addr) return null
  const numMatch = String(addr.address_1 ?? "").match(/\d+\S*$/)
  return {
    first_name: addr.first_name ?? null,
    last_name: addr.last_name ?? null,
    address_1: numMatch ? `*** ${numMatch[0]}` : "***",
    address_2: addr.address_2 ? "***" : null,
    city: addr.city,
    postal_code: addr.postal_code,
    country_code: addr.country_code,
    province: addr.province,
    phone: addr.phone ? `****${String(addr.phone).slice(-4)}` : null,
  }
}

// Medusa keeps order.status "pending" until completion and query.graph doesn't
// return the computed fulfillment_status — derive it from fulfillments
function deriveFulfillmentStatus(fulfillments: any[]): string {
  const active = fulfillments.filter((f) => f && !f.canceled_at)
  if (!active.length) return "not_fulfilled"
  const delivered = active.filter((f) => f.delivered_at).length
  const shipped = active.filter((f) => f.shipped_at && !f.delivered_at).length
  if (delivered === active.length) return "delivered"
  if (delivered > 0) return "partially_delivered"
  if (shipped === active.length) return "shipped"
  if (shipped > 0) return "partially_shipped"
  return "fulfilled" // created but nothing shipped yet
}

// summary is the truth source (admin uses it too) — payment_collections can
// report "completed" while paid_total is 0 (store-credit checkout)
function derivePaymentStatus(
  summary: { paid_total: number; pending_difference: number } | null,
  paymentCollections: any[]
): string {
  if (summary) {
    if (summary.pending_difference <= 0) return "captured"
    if (summary.paid_total > 0) return "partially_captured"
    return "awaiting"
  }
  const statuses = (paymentCollections ?? [])
    .filter(Boolean)
    .map((pc: any) => pc.status)
  if (!statuses.length) return "not_paid"
  if (statuses.every((s) => s === "completed")) return "captured"
  if (statuses.some((s) => s === "completed" || s === "partially_captured")) {
    return "partially_captured"
  }
  return "awaiting"
}

const NUMERIC_ITEM_FIELDS = [
  "quantity", "unit_price", "compare_at_unit_price",
  "total", "subtotal", "original_total", "discount_total", "tax_total",
  "item_total", "item_subtotal",
] as const

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { token: rawToken } = req.params

  const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerSvc = req.scope.resolve(Modules.CUSTOMER) as any

  let tokenData: { email: string; orderId: string | null }
  try {
    tokenData = await magicTokenSvc.verifyToken(rawToken, "order_view")
  } catch (e: any) {
    return res.status(401).json({ message: e.message })
  }

  if (!tokenData.orderId) {
    return res.status(400).json({ message: "Token is not linked to an order." })
  }

  // Fetch order — masking happens below, not on frontend
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "status", "currency_code", "email", "created_at",
      "metadata", "summary",
      "total", "subtotal", "item_subtotal", "discount_total", "tax_total",
      "shipping_total", "gift_card_total", "credit_line_total",
      "credit_lines.*",
      // items.* — explicit subfield lists drop computed fields (quantity/total)
      "items.*",
      "shipping_address.first_name", "shipping_address.last_name",
      "shipping_address.address_1", "shipping_address.address_2",
      "shipping_address.city", "shipping_address.postal_code",
      "shipping_address.country_code", "shipping_address.province",
      "shipping_address.phone",
      // explicit subfield lists drop computed amounts (same as items) — and
      // break the order's own shipping_total/total computation
      "shipping_methods.*",
      "fulfillments.id", "fulfillments.location_id", "fulfillments.canceled_at",
      "fulfillments.shipped_at", "fulfillments.delivered_at",
      "fulfillments.metadata",
      "fulfillments.items.title", "fulfillments.items.quantity",
      "fulfillments.items.line_item_id",
      "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
      "payment_collections.status",
      "payment_collections.payments.provider_id",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: { id: tokenData.orderId },
  })

  const order = orders[0]
  if (!order) return res.status(404).json({ message: "Order not found." })

  // Check if a registered account exists for this email — determines which block to show
  const registeredCustomers = await customerSvc.listCustomers({
    email: order.email,
    has_account: true,
  })
  const hasRegisteredAccount = registeredCustomers.length > 0

  const fulfillments = (order.fulfillments ?? []).filter(Boolean).map((f: any) => ({
    id: f.id,
    location_id: f.location_id,
    canceled_at: f.canceled_at,
    shipped_at: f.shipped_at,
    delivered_at: f.delivered_at,
    metadata: f.metadata?.tracking_number
      ? { tracking_number: f.metadata.tracking_number }
      : null,
    items: (f.items ?? []).filter(Boolean).map((fi: any) => ({
      title: fi.title,
      quantity: parseNum(fi.quantity),
      line_item_id: fi.line_item_id,
    })),
    labels: (f.labels ?? [])
      .filter((l: any) => l?.tracking_number)
      .map((l: any) => ({
        tracking_number: l.tracking_number,
        // sanitized — admin-entered URLs can be schemeless/truncated
        tracking_url: buildTrackingUrl(l.tracking_number, l.tracking_url),
      })),
    // legacy shape kept for the track page / older consumers
    tracking_links: (f.labels ?? [])
      .filter((l: any) => l?.tracking_number)
      .map((l: any) => ({
        tracking_number: l.tracking_number,
        url: buildTrackingUrl(l.tracking_number, l.tracking_url),
      })),
  }))

  const meta = (order.metadata ?? {}) as Record<string, unknown>

  const summary = order.summary
    ? {
        paid_total: parseNum(order.summary.paid_total),
        pending_difference: parseNum(order.summary.pending_difference),
        current_order_total: parseNum(order.summary.current_order_total),
      }
    : null

  res.json({
    order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      created_at: order.created_at,
      email: order.email,
      currency_code: order.currency_code,
      fulfillment_status: deriveFulfillmentStatus(order.fulfillments ?? []),
      payment_status: derivePaymentStatus(summary, order.payment_collections ?? []),
      summary,
      // summary.current_order_total is the backend truth (accounts for credit lines)
      total: summary?.current_order_total || parseNum(order.total),
      subtotal: parseNum(order.subtotal),
      item_subtotal: parseNum(order.item_subtotal),
      discount_total: parseNum(order.discount_total),
      tax_total: parseNum(order.tax_total),
      shipping_total: parseNum(order.shipping_total),
      gift_card_total: parseNum(order.gift_card_total),
      credit_line_total: parseNum((order as any).credit_line_total),
      credit_lines: ((order as any).credit_lines ?? [])
        .filter(Boolean)
        .map((cl: any) => ({
          reference: cl.reference,
          total: parseNum(cl.total ?? cl.amount),
        })),
      // whitelist — only the keys the order page needs, nothing internal
      metadata: {
        tracking: meta.tracking ?? undefined,
        warehouse_items: meta.warehouse_items ?? undefined,
      },
      items: (order.items ?? []).filter(Boolean).map((item: any) => {
        const out: Record<string, unknown> = { ...item }
        for (const k of NUMERIC_ITEM_FIELDS) {
          if (k in item) out[k] = parseNum(item[k])
        }
        delete out.metadata
        return out
      }),
      shipping_methods: (order.shipping_methods ?? [])
        .filter(Boolean)
        .map((sm: any) => ({ name: sm.name, total: parseNum(sm.total) })),
      // provider ids only — needed for guest payment instructions, no amounts/ids
      payment_collections: (order.payment_collections ?? [])
        .filter(Boolean)
        .map((pc: any) => ({
          payments: (pc.payments ?? [])
            .filter(Boolean)
            .map((p: any) => ({ provider_id: p.provider_id })),
          payment_sessions: (pc.payment_sessions ?? [])
            .filter(Boolean)
            .map((ps: any) => ({ provider_id: ps.provider_id })),
        })),
      fulfillments,
      shipping_address: maskAddress(order.shipping_address),
    },
    has_registered_account: hasRegisteredAccount,
  })
}
