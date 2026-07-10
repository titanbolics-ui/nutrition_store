import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "zod"
import { Resend } from "resend"
import { WAITLIST_MODULE } from "../../../modules/waitlist"
import { verifyTurnstile } from "../../../utils/turnstile"
import { checkRateLimit } from "../../../utils/rate-limit"

const ALWAYS_OK = { message: "You're on the waitlist. We'll email you if it comes back in stock." }
const BOT_REJECTED = { message: "Verification failed. Please try again." }

const schema = z.object({
  email: z.string().email().max(254),
  variant_id: z.string().min(1),
  marketing_consent: z.boolean(),
  turnstile_token: z.string().min(1),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown"
  if (!checkRateLimit(ip, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ message: "Too many requests. Please try again later." })
  }

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.json(ALWAYS_OK)

  const { email: rawEmail, variant_id, marketing_consent, turnstile_token } = parsed.data

  const turnstileOk = await verifyTurnstile(turnstile_token, ip)
  if (!turnstileOk) {
    return res.status(400).json(BOT_REJECTED)
  }

  const email = rawEmail.trim().toLowerCase()
  const logger = req.scope.resolve("logger") as any

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id", "product.title"],
    filters: { id: variant_id },
  })

  const variant = variants[0]
  if (!variant) return res.json(ALWAYS_OK)

  const waitlistSvc = req.scope.resolve(WAITLIST_MODULE) as any

  let signupResult: { row: any; isNew: boolean }
  try {
    signupResult = await waitlistSvc.signUp({
      productId: variant.product_id,
      variantId: variant_id,
      email,
      marketingConsent: marketing_consent,
    })
  } catch (err: any) {
    return res.status(400).json({ message: err.message })
  }

  const { row, isNew } = signupResult

  if (isNew) {
    try {
      const notificationSvc = req.scope.resolve("notification") as any
      await notificationSvc.createNotifications({
        to: email,
        channel: "email",
        template: "waitlist-confirmation",
        data: { productTitle: variant.product?.title ?? "this product" },
      })
    } catch (err: any) {
      logger.error("[waitlist] Failed to send confirmation email", err)
    }

    if (marketing_consent) {
      const segmentId = process.env.RESEND_SEGMENT_ID
      if (!segmentId) {
        logger.error("[waitlist] RESEND_SEGMENT_ID is not configured — skipping contact sync")
      } else {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY)
          // Contacts are org-level in the current API; segment membership is a
          // separate call (this SDK version has no `segments` field on create()).
          const { data, error } = await resend.contacts.create({ email, unsubscribed: false })

          if (error || !data) {
            logger.error("[waitlist] Resend contact create failed", error)
          } else {
            await waitlistSvc.setResendContactId(row.id, data.id)
            const { error: segmentError } = await resend.contacts.segments.add({
              contactId: data.id,
              segmentId,
            })
            if (segmentError) {
              logger.error("[waitlist] Resend segment assignment failed", segmentError)
            }
          }
        } catch (err: any) {
          logger.error("[waitlist] Resend contact sync threw", err)
        }
      }
    }
  }

  return res.json(ALWAYS_OK)
}
