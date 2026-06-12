import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEVENTEEN_TRACK_MODULE } from "../../../modules/seventeen-track"
import { verifyWebhookSignature, extractStatus } from "../../../utils/seventeen-track-client"
import { handleDeliveredTrack } from "../../../utils/seventeen-track-pool"

/**
 * 17track push webhook (configure in 17track dashboard → Settings → Webhook):
 *   https://<backend>/hooks/seventeen-track
 *
 * On Delivered: marks the fulfillment delivered (triggers the delivery email)
 * and frees the quota slot. Signature: sha256(`${rawBody}/${API_KEY}`) in the
 * `sign` header — raw body preserved via middlewares.ts.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  const rawBody = (req as any).rawBody?.toString?.() ?? JSON.stringify(req.body)
  const sign = (req.headers["sign"] as string) ?? undefined
  if (!verifyWebhookSignature(rawBody, sign)) {
    logger.warn("[17track webhook] invalid signature — rejected")
    return res.status(401).json({ ok: false })
  }

  const body = req.body as any
  const event: string = body?.event ?? ""
  const number: string | undefined = body?.data?.number
  const status = extractStatus(body?.data)

  // Always 200 fast — 17track retries non-2xx and we don't want dupes
  res.json({ ok: true })

  if (!number) return

  try {
    const poolSvc = req.scope.resolve(SEVENTEEN_TRACK_MODULE) as any
    const rows = await poolSvc.listTrackedNumbers({ tracking_number: number })
    const row = rows[0]
    if (!row) {
      logger.info(`[17track webhook] ${number} not in pool — ignoring (${event})`)
      return
    }

    if (status && status !== row.last_status) {
      await poolSvc.updateTrackedNumbers([{ id: row.id, last_status: status }])
    }

    if (event === "TRACKING_UPDATED" && status === "Delivered") {
      await handleDeliveredTrack(req.scope as any, row)
    } else {
      logger.info(`[17track webhook] ${number}: ${event} / ${status ?? "?"}`)
    }
  } catch (err: any) {
    logger.error(`[17track webhook] processing failed for ${number}: ${err?.message}`)
  }
}
