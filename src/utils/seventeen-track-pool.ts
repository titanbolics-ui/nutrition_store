import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/core-flows"
import { SEVENTEEN_TRACK_MODULE } from "../modules/seventeen-track"
import { deleteTrack } from "./seventeen-track-client"

export type PoolRow = {
  id: string
  tracking_number: string
  fulfillment_id: string
  order_id: string
  display_id: number | null
  carrier: number | null
  last_status: string | null
  registered_at: Date | string
}

/**
 * A pooled track reached "Delivered" on 17track:
 *  1. mark the fulfillment as delivered (same workflow as the admin button —
 *     emits delivery.created, which sends the "Order Delivered" email)
 *  2. delete the number from 17track to free a quota slot
 *  3. drop the pool row
 */
export async function handleDeliveredTrack(
  container: MedusaContainer,
  row: PoolRow
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // guard: don't double-deliver (admin may have clicked the button already)
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "delivered_at", "canceled_at"],
    filters: { id: row.fulfillment_id },
  })
  const fulfillment = fulfillments[0] as any

  if (fulfillment && !fulfillment.delivered_at && !fulfillment.canceled_at) {
    await markOrderFulfillmentAsDeliveredWorkflow(container as any).run({
      input: { orderId: row.order_id, fulfillmentId: row.fulfillment_id },
    })
    logger.info(
      `[17track] ONX-${row.display_id ?? "?"} ${row.tracking_number}: marked delivered → delivery email triggered`
    )
  } else {
    logger.info(
      `[17track] ONX-${row.display_id ?? "?"} ${row.tracking_number}: fulfillment already delivered/canceled — cleanup only`
    )
  }

  await removeFromPool(container, row, "delivered")
}

/** Delete a track from 17track (best-effort) and drop its pool row. */
export async function removeFromPool(
  container: MedusaContainer,
  row: PoolRow,
  reason: string
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const poolSvc = container.resolve(SEVENTEEN_TRACK_MODULE) as any

  try {
    await deleteTrack([{ number: row.tracking_number, carrier: row.carrier ?? undefined }])
  } catch (err: any) {
    // quota slot stays burned until the next job run retries via stale cleanup
    logger.warn(`[17track] deletetrack failed for ${row.tracking_number}: ${err?.message}`)
  }

  await poolSvc.deleteTrackedNumbers([row.id])
  logger.info(`[17track] ${row.tracking_number} removed from pool (${reason})`)
}
