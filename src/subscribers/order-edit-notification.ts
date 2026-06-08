import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

function parseNum(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v) || 0
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("numeric_" in o) return parseFloat(String(o.numeric_)) || 0  // Medusa BigNumber
    if ("value" in o)    return parseFloat(String(o.value)) || 0     // older format
  }
  return 0
}

type RawAction = {
  action: string
  details?: Record<string, unknown> | null
}

export type ResolvedChange = {
  product_title: string
  variant_title?: string
  thumbnail?: string
  quantity: number
  unit_price: number
  amount: number          // positive = customer pays more, negative = refund
  action_type: "add" | "remove" | "update"
}

type LineItemData = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  unit_price: number
}

function formatPaymentMethod(providerId: string): string {
  if (providerId.includes("cash-app"))      return "Cash App (Bitcoin)"
  if (providerId.includes("crypto-manual")) return "Bitcoin (BTC)"
  if (providerId.includes("paypal-manual")) return "PayPal"
  if (providerId.includes("card-manual"))   return "Card"
  return providerId
}

function resolveChanges(
  actions: RawAction[],
  itemById: Map<string, LineItemData>
): ResolvedChange[] {
  const changes: ResolvedChange[] = []

  for (const a of actions) {
    if (!["ITEM_ADD", "ITEM_REMOVE", "ITEM_UPDATE"].includes(a.action)) continue

    const details    = a.details ?? {}
    const refId      = details.reference_id as string | undefined
    const qty        = Number(details.quantity ?? 1)
    const qtyDiff    = details.quantity_diff != null ? Number(details.quantity_diff) : null
    const priceFromAction = Number(details.unit_price ?? 0)

    const item      = refId ? itemById.get(refId) : undefined
    const title     = item?.product_title ?? item?.title ?? refId ?? "Item"
    const variant   = item?.variant_title ?? undefined
    const thumbnail = item?.thumbnail ?? undefined
    const unitPrice = priceFromAction || item?.unit_price || 0

    if (a.action === "ITEM_ADD") {
      changes.push({
        product_title: title,
        variant_title: variant,
        thumbnail,
        quantity: qty,
        unit_price: unitPrice,
        amount: unitPrice * qty,
        action_type: "add",
      })
    } else if (a.action === "ITEM_REMOVE") {
      changes.push({
        product_title: title,
        variant_title: variant,
        thumbnail,
        quantity: qty,
        unit_price: unitPrice,
        amount: -(unitPrice * qty),
        action_type: "remove",
      })
    } else if (a.action === "ITEM_UPDATE") {
      const diff = qtyDiff ?? qty
      changes.push({
        product_title: title,
        variant_title: variant,
        thumbnail,
        quantity: Math.abs(diff),   // show how many units changed, not the new total
        unit_price: unitPrice,
        amount: unitPrice * diff,
        action_type: "update",
      })
    }
  }

  return changes
}

export default async function orderEditNotificationHandler({
  event: { name: eventName, data },
  container,
}: SubscriberArgs<{ order_id: string; actions: RawAction[]; no_notification?: boolean }>) {
  const logger = container.resolve("logger")
  const query  = container.resolve("query")
  const notificationService = container.resolve("notification")

  if (data.no_notification) {
    logger.info(`[order-edit-notification] Skipping ${eventName} — no_notification=true`)
    return
  }

  logger.info(`[order-edit-notification] ${eventName} for order ${data.order_id}`)

  try {
    const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
    const orderResult = await remoteQuery({
      entryPoint: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "items.id",
        "items.title",
        "items.product_title",
        "items.variant_title",
        "items.thumbnail",
        "items.unit_price",
        "items.quantity",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.refunds.amount",
        "payment_collections.payment_sessions.provider_id",
      ],
      variables: { id: data.order_id },
    })

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult
    if (!order?.email) {
      logger.warn(`[order-edit-notification] No email for order ${data.order_id}`)
      return
    }

    const allPaymentsArr = (order as any).payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []

    // Build item lookup from order items
    const itemById = new Map<string, LineItemData>()
    for (const item of order.items ?? []) {
      if (!item?.id) continue
      itemById.set(item.id, {
        id: item.id,
        title: item.title,
        product_title: item.product_title,
        variant_title: item.variant_title,
        thumbnail: item.thumbnail,
        unit_price: parseNum(item.unit_price),
      })
    }

    // For ITEM_ADD — newly created line items may not be in order.items yet (pre-confirm)
    const missingIds = (data.actions ?? [])
      .map(a => a.details?.reference_id as string | undefined)
      .filter((id): id is string => !!id && !itemById.has(id))

    if (missingIds.length > 0) {
      try {
        const { data: lineItems } = await query.graph({
          entity: "order_line_item",
          filters: { id: missingIds },
          fields: ["id", "title", "product_title", "variant_title", "thumbnail", "unit_price"],
        })
        for (const item of lineItems ?? []) {
          if (!item?.id) continue
          itemById.set(item.id, {
            id: item.id,
            title: item.title,
            product_title: item.product_title,
            variant_title: item.variant_title,
            thumbnail: item.thumbnail,
            unit_price: parseNum(item.unit_price),
          })
        }
      } catch (e: any) {
        logger.warn(`[order-edit-notification] Could not fetch missing line items: ${e.message}`)
      }
    }

    const changes = resolveChanges(data.actions ?? [], itemById)

    const totalCaptured = allPaymentsArr
      .filter((p: any) => p.captured_at)
      .reduce((s: number, p: any) => s + parseNum(p.amount), 0)
    const totalRefunded = allPaymentsArr
      .flatMap((p: any) => p.refunds ?? [])
      .reduce((s: number, r: any) => s + parseNum(r.amount), 0)
    const orderTotal  = parseNum((order as any).total)
    const pendingDiff = orderTotal - totalCaptured + totalRefunded
    const paidTotal   = totalCaptured - totalRefunded
    const actionsDiff = changes.reduce((sum, c) => sum + c.amount, 0)

    // both events: show the CHANGE amount from this specific edit
    const amountDue = actionsDiff

    // Resolve payment provider — skip system_default, use first real customer provider
    const customerPayment = allPaymentsArr.find(
      (p: any) => p.provider_id && !p.provider_id.includes("system_default")
    )
    const providerId =
      customerPayment?.provider_id ||
      (order as any).payment_collections?.[0]?.payment_sessions?.[0]?.provider_id ||
      ""
    const paymentMethod = formatPaymentMethod(providerId)

    const payload = {
      order,
      changes,
      amountDue,
      paidTotal,
      paymentMethod,
      providerId,
    }

    if (eventName === "order-edit.requested") {
      await notificationService.createNotifications({
        to: order.email,
        channel: "email",
        template: "order-edit-requested",
        data: payload,
      })
      logger.info(`[order-edit-notification] Sent requested email to ${order.email}`)
    } else if (eventName === "order-edit.confirmed") {
      await notificationService.createNotifications({
        to: order.email,
        channel: "email",
        template: "order-edit-confirmed",
        data: payload,
      })
      logger.info(`[order-edit-notification] Sent confirmed email to ${order.email}`)
    }
  } catch (err: any) {
    logger.error(`[order-edit-notification] Failed: ${err.message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order-edit.requested", "order-edit.confirmed"],
}
