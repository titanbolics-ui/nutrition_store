import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  verifyWebhookSignature,
  isDelivered,
  type EasyPostWebhookEvent,
} from "../../../utils/easypost-client"
import { markDeliveredByTrackingNumber } from "../../../utils/easypost-tracker"

/**
 * EasyPost webhook (configure in EasyPost dashboard → Webhooks):
 *   https://<backend>/hooks/easypost
 *
 * EasyPost self-updates the trackers we register and pushes `tracker.updated`
 * events here. On a delivered status we mark the fulfillment delivered, which
 * triggers the delivery email. Signature: HMAC-SHA256 over the raw body in the
 * `X-Hmac-Signature` header — raw body preserved via middlewares.ts.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)
  if (!verifyWebhookSignature(rawBody, req.headers as Record<string, unknown>)) {
    logger.warn("[easypost webhook] invalid signature — rejected")
    return res.status(401).json({ ok: false })
  }

  const event = req.body as EasyPostWebhookEvent
  const trackingCode = event?.result?.tracking_code
  const status = event?.result?.status

  // Always 200 fast — EasyPost retries non-2xx and we don't want dupes
  res.json({ ok: true })

  if (!trackingCode) return

  try {
    if (isDelivered(event)) {
      await markDeliveredByTrackingNumber(req.scope as any, trackingCode)
    } else {
      logger.info(`[easypost webhook] ${trackingCode}: ${status ?? "?"} — no action`)
    }
  } catch (err: any) {
    logger.error(`[easypost webhook] processing failed for ${trackingCode}: ${err?.message}`)
  }
}
