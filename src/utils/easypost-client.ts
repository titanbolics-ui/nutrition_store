import { createHash, createHmac, timingSafeEqual } from "crypto"

// Thin client for the EasyPost API (delivery tracking only).
// Docs: https://docs.easypost.com/docs/trackers
//       https://support.easypost.com/hc/en-us/articles/39826034964237
//
// We create standalone trackers for packages whose labels we didn't buy through
// EasyPost. EasyPost updates them in the background and pushes tracker.updated
// webhooks, so there is no polling loop or quota pool to manage.

const BASE_URL = "https://api.easypost.com/v2"

export function getApiKey(): string {
  return (process.env.EASYPOST_API_KEY ?? "").trim()
}

export function getWebhookSecret(): string {
  return (process.env.EASYPOST_WEBHOOK_SECRET ?? "").trim()
}

export function isConfigured(): boolean {
  return !!getApiKey()
}

export type EasyPostTracker = {
  id: string
  status: string
  tracking_code: string
  carrier: string
  [key: string]: unknown
}

/**
 * Create (or fetch, via EasyPost's built-in dedup) a tracker.
 * Same tracking_code + carrier within 3 months returns the original tracker, so
 * no explicit "already registered" handling is needed. Carrier is ALWAYS passed
 * explicitly — we never rely on EasyPost auto-detection.
 */
export async function createTracker(
  trackingCode: string,
  carrier: string
): Promise<EasyPostTracker> {
  const auth = Buffer.from(`${getApiKey()}:`).toString("base64")
  const res = await fetch(`${BASE_URL}/trackers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ tracker: { tracking_code: trackingCode, carrier } }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`EasyPost create tracker HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return JSON.parse(text) as EasyPostTracker
}

// EasyPost tracker.updated webhook event shape (the parts we use).
export type EasyPostWebhookEvent = {
  description?: string
  result?: {
    object?: string
    tracking_code?: string
    status?: string
    [key: string]: unknown
  }
}

/** Top-level tracker status is authoritative — "delivered" means delivered. */
export function isDelivered(event: EasyPostWebhookEvent): boolean {
  return event?.result?.status === "delivered"
}

/**
 * Verify an EasyPost webhook signature.
 *
 * Mirrors EasyPost's official client `validateWebhook` (easypost-node
 * src/utils/util.js) exactly — do not "simplify":
 *  - key  = NFKD-normalized secret, utf8 bytes
 *  - algo = HMAC-SHA256, lowercase hex, value `hmac-sha256-hex=<hex>`
 *  - body = the raw body with EasyPost's weight correction applied (integer
 *    `weight` values get a trailing `.0`). EasyPost signs the corrected body, so
 *    skipping this fails verification for every payload with an integer weight.
 *  - header = `X-Hmac-Signature` (Node lowercases → `x-hmac-signature`); we also
 *    accept `x-hmac-signature-v2` against the SAME digest, so it can never reject
 *    a valid standard signature.
 * Timing-safe compare. Fail-closed bugs here turn every real webhook into a 401.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  headers: Record<string, unknown>,
  secret = getWebhookSecret()
): boolean {
  if (!secret) return false

  const candidates = [
    headerValue(headers, "x-hmac-signature"),
    headerValue(headers, "x-hmac-signature-v2"),
  ].filter((v): v is string => typeof v === "string")
  if (candidates.length === 0) return false

  const normalizedSecret = secret.normalize("NFKD")
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody)
  const correctedBody = applyWeightCorrection(body)
  const digest = createHmac("sha256", Buffer.from(normalizedSecret, "utf8"))
    .update(correctedBody, "utf8")
    .digest("hex")
  const expected = `hmac-sha256-hex=${digest}`

  return candidates.some((c) => safeEqual(c, expected))
}

// EasyPost generates the signature over a body where integer `weight` values
// carry a trailing `.0` (e.g. `"weight":16` → `"weight":16.0`). Same regex as
// the official client — apply before computing the HMAC to match their digest.
function applyWeightCorrection(body: string): string {
  return body.replace(/("weight":\s*)(\d+)(\s*)(?=,|\})/g, "$1$2.0")
}

function headerValue(
  headers: Record<string, unknown>,
  name: string
): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(v)) return v[0]
  return typeof v === "string" ? v : undefined
}

// Constant-time compare independent of input length (hash both sides first so
// timingSafeEqual always gets equal-length buffers).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a.toLowerCase()).digest()
  const hb = createHash("sha256").update(b.toLowerCase()).digest()
  return timingSafeEqual(ha, hb)
}
