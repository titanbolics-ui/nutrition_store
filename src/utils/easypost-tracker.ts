import { MedusaContainer } from "@medusajs/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/core-flows"
import { createTracker, isConfigured } from "./easypost-client"
import { resolveCarrier } from "./resolve-carrier"

/** Read the tracking number off a fulfillment (label first, metadata fallback). */
function trackingNumberOf(fulfillment: any): string | undefined {
  return (
    fulfillment?.labels?.find((l: any) => l?.tracking_number)?.tracking_number ||
    (fulfillment?.metadata?.tracking_number
      ? String(fulfillment.metadata.tracking_number)
      : undefined)
  )
}

/**
 * Register an EasyPost tracker for a fulfillment's tracking number.
 *
 * Idempotent: skips if a tracker was already registered (metadata flag) or if
 * EasyPost dedups the code. Carrier is resolved explicitly from the number — if
 * it can't be resolved, the tracker is NOT registered and the fulfillment is
 * flagged `carrier_unresolved` for manual review (never auto-detected).
 */
export async function registerTrackerForFulfillment(
  container: MedusaContainer,
  fulfillmentId: string,
  trackingNumberOverride?: string
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  if (!isConfigured()) {
    logger.info("[easypost] EASYPOST_API_KEY not set — skipping registration")
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as any

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "metadata",
      "labels.tracking_number",
      "order.display_id",
    ],
    filters: { id: fulfillmentId } as any,
  })
  const fulfillment = fulfillments?.[0] as any
  if (!fulfillment) {
    logger.warn(`[easypost] fulfillment ${fulfillmentId} not found — skip register`)
    return
  }

  // Already registered → nothing to do (idempotency flag in metadata)
  if (fulfillment.metadata?.easypost_tracker_id) return

  const trackingNumber = trackingNumberOverride?.trim() || trackingNumberOf(fulfillment)
  if (!trackingNumber) return // no tracking yet — registered later when attached

  const onx = fulfillment.order?.display_id ? `ONX-${fulfillment.order.display_id}` : "?"
  const carrier = resolveCarrier(trackingNumber)

  if (!carrier) {
    await fulfillmentModule.updateFulfillment(fulfillmentId, {
      metadata: { ...(fulfillment.metadata ?? {}), carrier_unresolved: true },
    })
    logger.warn(
      `[easypost] ${onx} ${trackingNumber}: carrier unresolved — not registered, flagged for manual review`
    )
    return
  }

  try {
    const tracker = await createTracker(trackingNumber, carrier)
    const { carrier_unresolved, ...rest } = (fulfillment.metadata ?? {}) as Record<string, unknown>
    await fulfillmentModule.updateFulfillment(fulfillmentId, {
      metadata: {
        ...rest,
        easypost_tracker_id: tracker.id,
        easypost_carrier: carrier,
      },
    })
    logger.info(`[easypost] ${onx} ${trackingNumber}: registered (${carrier}) → ${tracker.id}`)
  } catch (err: any) {
    logger.error(`[easypost] ${onx} ${trackingNumber}: register failed — ${err?.message}`)
  }
}

/**
 * Mark the fulfillment carrying `trackingCode` as delivered.
 *
 * Looks the fulfillment up among recent shipped, undelivered fulfillments (same
 * query the old pool job used), guards against double-delivery, then runs the
 * native workflow — which sets `delivered_at` and emits `delivery.created`,
 * driving the "Order Delivered" email. Idempotent: a second identical webhook
 * finds `delivered_at` already set and does nothing.
 */
export async function markDeliveredByTrackingNumber(
  container: MedusaContainer,
  trackingCode: string
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "shipped_at",
      "delivered_at",
      "canceled_at",
      "metadata",
      "labels.tracking_number",
      "order.id",
      "order.display_id",
    ],
    filters: { shipped_at: { $ne: null } } as any,
    pagination: { take: 200, skip: 0, order: { shipped_at: "DESC" } },
  })

  const target = (fulfillments as any[]).find(
    (f) => trackingNumberOf(f) === trackingCode
  )

  if (!target) {
    logger.info(`[easypost] delivered webhook for ${trackingCode} — no matching fulfillment`)
    return
  }

  const onx = target.order?.display_id ? `ONX-${target.order.display_id}` : "?"

  if (target.delivered_at || target.canceled_at || !target.order?.id) {
    logger.info(`[easypost] ${onx} ${trackingCode}: already delivered/canceled — no-op`)
    return
  }

  await markOrderFulfillmentAsDeliveredWorkflow(container as any).run({
    input: { orderId: target.order.id, fulfillmentId: target.id },
  })
  logger.info(`[easypost] ${onx} ${trackingCode}: marked delivered → delivery email triggered`)
}
