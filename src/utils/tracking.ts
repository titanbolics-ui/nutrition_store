export const TRACKING_BASE_URL =
  "https://dealer-send.com/en-US/track-my-shipment?trackingNumber="

// Admin-entered tracking URLs are untrusted: schemes get dropped, strings get
// truncated. Anything that isn't an absolute http(s) URL falls back to the
// carrier page built from the tracking number.
export function buildTrackingUrl(
  trackingNumber: string,
  rawUrl?: string | null
): string {
  if (rawUrl && /^https?:\/\//i.test(rawUrl.trim())) return rawUrl.trim()
  return `${TRACKING_BASE_URL}${trackingNumber}`
}
