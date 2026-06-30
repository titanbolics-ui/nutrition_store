import { MedusaContainer } from "@medusajs/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEVENTEEN_TRACK_MODULE } from "../modules/seventeen-track"
import {
  ALREADY_REGISTERED_CODE,
  extractStatus,
  getPoolSize,
  getTrackInfo,
  isConfigured,
  registerNumbers,
} from "../utils/seventeen-track-client"
import { handleDeliveredTrack, removeFromPool, PoolRow } from "../utils/seventeen-track-pool"

// Tracks that never resolve shouldn't hold a quota slot forever
const STALE_DAYS = 45

/**
 * Keeps the 17track pool (free plan: 40 active trackings) in sync:
 *  1. polls registered tracks — Delivered → mark fulfillment delivered
 *     (fallback for missed webhooks; the webhook is the fast path)
 *  2. evicts stale/expired tracks to free slots
 *  3. fills free slots with the newest shipped, undelivered fulfillments
 */
export default async function sync17trackPool(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  if (!isConfigured()) {
    logger.info("sync-17track-pool: SEVENTEEN_TRACK_API_KEY not set — skipping")
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const poolSvc = container.resolve(SEVENTEEN_TRACK_MODULE) as any
  const poolSize = getPoolSize()

  let pool: PoolRow[] = await poolSvc.listTrackedNumbers({}, { take: null })

  // ── 1. Poll current statuses (webhook fallback) ────────────────────────────
  if (pool.length) {
    try {
      const { accepted } = await getTrackInfo(
        pool.map((r) => ({ number: r.tracking_number, carrier: r.carrier ?? undefined }))
      )
      const byNumber = new Map(accepted.map((a: any) => [a.number, a]))

      for (const row of [...pool]) {
        const info = byNumber.get(row.tracking_number)
        const status = extractStatus(info)
        if (!status) continue

        if (status !== row.last_status) {
          await poolSvc.updateTrackedNumbers([{ id: row.id, last_status: status }])
        }

        if (status === "Delivered") {
          try {
            await handleDeliveredTrack(container as any, row)
            pool = pool.filter((r) => r.id !== row.id)
          } catch (err: any) {
            logger.error(`[17track] failed to process delivered ${row.tracking_number}: ${err?.message}`)
          }
        } else if (status === "Expired") {
          await removeFromPool(container as any, row, "expired on 17track")
          pool = pool.filter((r) => r.id !== row.id)
        }
      }
    } catch (err: any) {
      logger.error(`sync-17track-pool: gettrackinfo failed — ${err?.message}`)
    }
  }

  // ── 2. Evict stale tracks ──────────────────────────────────────────────────
  const staleBefore = new Date()
  staleBefore.setDate(staleBefore.getDate() - STALE_DAYS)
  for (const row of [...pool]) {
    if (new Date(row.registered_at) < staleBefore) {
      await removeFromPool(container as any, row, `older than ${STALE_DAYS} days`)
      pool = pool.filter((r) => r.id !== row.id)
    }
  }

  // ── 3. Fill free slots with newest shipped, undelivered fulfillments ──────
  const freeSlots = poolSize - pool.length
  if (freeSlots <= 0) {
    logger.info(`sync-17track-pool: pool full (${pool.length}/${poolSize})`)
    return
  }

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

  const inPool = new Set(pool.map((r) => r.tracking_number))
  const candidates: { number: string; fulfillment: any }[] = []
  for (const f of fulfillments as any[]) {
    if (!f?.shipped_at || f.delivered_at || f.canceled_at || !f.order?.id) continue
    const trackingNumber: string | undefined =
      f.labels?.find((l: any) => l?.tracking_number)?.tracking_number ||
      f.metadata?.tracking_number
    if (!trackingNumber || inPool.has(trackingNumber)) continue
    if (candidates.some((c) => c.number === trackingNumber)) continue
    // USPS domestic (22 digits starting with 9) — manual-only, never auto-register
    if (/^9\d{21}$/.test(trackingNumber)) continue
    candidates.push({ number: trackingNumber, fulfillment: f })
    if (candidates.length >= freeSlots) break
  }

  if (!candidates.length) {
    logger.info(`sync-17track-pool: nothing new to register (${pool.length}/${poolSize})`)
    return
  }

  try {
    const { accepted, rejected } = await registerNumbers(
      candidates.map((c) => ({ number: c.number }))
    )
    const acceptedNumbers = new Map(accepted.map((a: any) => [a.number, a]))
    for (const r of rejected) {
      if (r.error?.code === ALREADY_REGISTERED_CODE) {
        acceptedNumbers.set(r.number, r) // already in 17track — still track it in our pool
      } else {
        logger.warn(`[17track] register rejected ${r.number}: ${r.error?.message ?? "unknown"}`)
      }
    }

    let registered = 0
    for (const c of candidates) {
      const acc = acceptedNumbers.get(c.number)
      if (!acc) continue
      await poolSvc.createTrackedNumbers([
        {
          tracking_number: c.number,
          fulfillment_id: c.fulfillment.id,
          order_id: c.fulfillment.order.id,
          display_id: c.fulfillment.order.display_id ?? null,
          carrier: (acc as any).carrier ?? null,
          registered_at: new Date(),
        },
      ])
      registered++
      logger.info(`[17track] registered ${c.number} (ONX-${c.fulfillment.order.display_id})`)
    }

    logger.info(
      `✅ sync-17track-pool: ${registered} registered, pool ${pool.length + registered}/${poolSize}`
    )
  } catch (err: any) {
    logger.error(`sync-17track-pool: register failed — ${err?.message}`)
  }
}

export const config = {
  name: "sync-17track-pool",
  schedule: "7,37 * * * *", // twice an hour, offset from the sheets jobs
}
