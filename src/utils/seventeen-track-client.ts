import { createHash } from "crypto"

// Thin client for the 17track v2.2 API.
// Docs: https://api.17track.net/en/doc?version=v2.2
// Free plan: 40 active trackings — pool management lives in the
// sync-17track-pool job; this file only talks HTTP.

const BASE_URL = "https://api.17track.net/track/v2.2"

export type RegisterItem = { number: string; carrier?: number; auto_detection?: boolean }
export type ApiListResult = {
  accepted: any[]
  rejected: { number: string; error?: { code: number; message: string } }[]
}

// rejected.error.code when the number is already registered — treat as accepted
export const ALREADY_REGISTERED_CODE = -18019901

export function getApiKey(): string {
  return (process.env.SEVENTEEN_TRACK_API_KEY ?? "").trim()
}

export function isConfigured(): boolean {
  return !!getApiKey()
}

export function getPoolSize(): number {
  const n = parseInt(process.env.SEVENTEEN_TRACK_POOL_SIZE ?? "40", 10)
  return isNaN(n) ? 40 : n
}

async function call(path: string, body: unknown): Promise<ApiListResult> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "17token": getApiKey(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`17track ${path} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const json: any = await res.json()
  if (json.code !== 0) {
    throw new Error(`17track ${path} error code ${json.code}: ${JSON.stringify(json.data ?? {}).slice(0, 300)}`)
  }
  return {
    accepted: json.data?.accepted ?? [],
    rejected: json.data?.rejected ?? [],
  }
}

/** Register numbers for tracking (max 40 per call). auto_detection by default. */
export async function registerNumbers(items: RegisterItem[]): Promise<ApiListResult> {
  return call(
    "register",
    items.map((i) => ({ auto_detection: i.carrier ? undefined : true, ...i }))
  )
}

/** Current track info; accepted[].track_info.latest_status.status holds the state. */
export async function getTrackInfo(numbers: { number: string; carrier?: number }[]): Promise<ApiListResult> {
  return call("gettrackinfo", numbers)
}

/** Remove numbers from the 17track quota pool. */
export async function deleteTrack(numbers: { number: string; carrier?: number }[]): Promise<ApiListResult> {
  return call("deletetrack", numbers)
}

/**
 * Webhook signature: header `sign` = SHA256(`${rawBody}/${apiKey}`) hex.
 * Set SEVENTEEN_TRACK_WEBHOOK_UNSIGNED=true to skip (debugging only).
 */
export function verifyWebhookSignature(rawBody: string, sign: string | undefined): boolean {
  if (process.env.SEVENTEEN_TRACK_WEBHOOK_UNSIGNED === "true") return true
  if (!sign) return false
  const expected = createHash("sha256").update(`${rawBody}/${getApiKey()}`).digest("hex")
  return sign.toLowerCase() === expected
}

/** Main statuses from 17track we care about. */
export type TrackStatus =
  | "NotFound" | "InfoReceived" | "InTransit" | "Expired"
  | "AvailableForPickup" | "OutForDelivery" | "DeliveryFailure"
  | "Delivered" | "Exception"

export function extractStatus(trackInfo: any): TrackStatus | undefined {
  return trackInfo?.track_info?.latest_status?.status
}
