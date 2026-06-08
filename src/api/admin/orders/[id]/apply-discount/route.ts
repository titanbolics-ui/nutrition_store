import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  Modules,
  ContainerRegistrationKeys,
  ChangeActionType,
} from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  createOrderChangeActionsWorkflow,
  confirmOrderEditRequestWorkflow,
} from "@medusajs/core-flows"

const MANUAL_DISCOUNT_CODE = "manual-discount"

function parseNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v) || 0
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("numeric_" in o && o.numeric_ != null) return parseFloat(String(o.numeric_)) || 0
    if ("bignumber_" in o) {
      const bn = (o.bignumber_ as any)
      if (bn?.value != null) return parseFloat(String(bn.value)) || 0
    }
    if ("value" in o) return parseFloat(String(o.value)) || 0
  }
  return 0
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { amount, reason } = req.body as { amount: number; reason?: string }

  if (typeof amount !== "number" || amount < 0) {
    return res.status(400).json({ message: "amount must be a non-negative number" })
  }

  const query    = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderSvc = req.scope.resolve(Modules.ORDER) as any

  try {
    return await applyDiscount({ id, amount, reason, query, orderSvc, req, res })
  } catch (e: any) {
    console.error("[apply-discount] error:", e?.message, e?.stack)
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}

async function applyDiscount({ id, amount, reason, query, orderSvc, req, res }: {
  id: string; amount: number; reason?: string
  query: any; orderSvc: any; req: MedusaRequest; res: MedusaResponse
}) {
  // Fetch order version
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "version"],
    filters: { id },
  })
  const order = orders[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  // Fetch OrderItem records via internal service — these have item_id (= OrderLineItem.id),
  // unit_price and quantity reliably
  const orderItems: any[] = await orderSvc.orderItemService_.list(
    { order_id: id, version: order.version },
    {}
  )
  if (!orderItems.length) {
    return res.status(400).json({ message: "Order has no items" })
  }

  const lineItemIds: string[] = orderItems.map((oi: any) => oi.item_id).filter(Boolean)

  // Fetch existing adjustments
  const existingAdjs: any[] = lineItemIds.length
    ? await orderSvc.orderLineItemAdjustmentService_.list(
        { item_id: lineItemIds },
        {}
      )
    : []

  // Group non-manual adjustments by line item ID
  const nonManualByItemId: Record<string, any[]> = {}
  for (const adj of existingAdjs) {
    if (adj.code !== MANUAL_DISCOUNT_CODE) {
      ;(nonManualByItemId[adj.item_id] ??= []).push(adj)
    }
  }

  // Compute discount distribution across items
  const discountByItemId: Record<string, number> = {}

  if (amount > 0) {
    const itemWeights = orderItems.map((oi: any) => {
      const up  = parseNum(oi.unit_price)
      const qty = parseNum(oi.quantity)
      return { lineItemId: oi.item_id, subtotal: up * qty }
    })
    const totalSubtotal = itemWeights.reduce((s, i) => s + i.subtotal, 0)

    if (totalSubtotal <= 0) {
      // Fallback: distribute equally
      const share = Math.round((amount / orderItems.length) * 100) / 100
      orderItems.forEach((oi: any) => { discountByItemId[oi.item_id] = share })
      // Fix rounding on last item
      const last = orderItems[orderItems.length - 1]
      const assigned = share * (orderItems.length - 1)
      discountByItemId[last.item_id] = Math.round((amount - assigned) * 100) / 100
    } else {
      let remaining = amount
      for (let i = 0; i < itemWeights.length; i++) {
        const { lineItemId, subtotal } = itemWeights[i]
        const isLast = i === itemWeights.length - 1
        const share = isLast
          ? Math.round(remaining * 100) / 100
          : Math.round((subtotal / totalSubtotal) * amount * 100) / 100
        remaining = Math.round((remaining - share) * 100) / 100
        discountByItemId[lineItemId] = share
      }
    }
  }

  // Begin order edit
  const { result: orderChange } = await beginOrderEditOrderWorkflow(req.scope).run({
    input: { order_id: id },
  })

  // Build ITEM_ADJUSTMENTS_REPLACE actions — one per item
  const actions = orderItems.map((oi: any) => {
    const lineItemId = oi.item_id
    const nonManual  = (nonManualByItemId[lineItemId] ?? []).map((adj: any) => ({
      item_id:      lineItemId,
      amount:       parseNum(adj.amount),
      code:         adj.code,
      description:  adj.description ?? undefined,
      promotion_id: adj.promotion_id ?? undefined,
    }))

    const discountShare = discountByItemId[lineItemId] ?? 0
    const manualAdj = discountShare > 0
      ? [{
          item_id:     lineItemId,
          amount:      discountShare,   // positive — calculation subtracts it from subtotal
          code:        MANUAL_DISCOUNT_CODE,
          description: reason || "Manual discount",
        }]
      : []

    return {
      order_change_id: orderChange.id,
      order_id:        id,
      version:         orderChange.version,
      action:          ChangeActionType.ITEM_ADJUSTMENTS_REPLACE,
      details: {
        reference_id: lineItemId,
        adjustments:  [...nonManual, ...manualAdj],
      },
    }
  })

  await createOrderChangeActionsWorkflow(req.scope).run({ input: actions })

  // Confirm — this applies changes and properly updates order_summary
  await confirmOrderEditRequestWorkflow(req.scope).run({
    input: { order_id: id },
  })

  res.status(200).json({ success: true })
}
