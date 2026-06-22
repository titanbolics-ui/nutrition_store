// Explicit carrier resolution for EasyPost trackers.
//
// We resolve the carrier ourselves from the tracking-number format and pass it
// explicitly to EasyPost — EasyPost auto-detection is NEVER used. A null result
// means "unknown": the tracker is not registered and the fulfillment is flagged
// for manual review (see registerTrackerForFulfillment).
//
// Patterns are built from real sample tracking numbers, not guesses. Add a new
// entry here when a new shipping line appears.

// Exact EasyPost carrier identifier strings (the value for the tracker "carrier"
// field). USPS is "USPS"; GoFo ships as "GOFO/CIRRO E-Commerce" in EasyPost,
// whose identifier is believed to be "CirroECommerce".
export type CarrierId = "USPS" | "CirroECommerce"

// `verified: false` means the format is recognized but its EasyPost carrier
// identifier is NOT yet confirmed against live Carrier Metadata. Unverified
// matches resolve to null → the fulfillment is flagged `carrier_unresolved` for
// manual review instead of being registered with a possibly-wrong identifier.
type CarrierPattern = { carrier: CarrierId; pattern: RegExp; verified: boolean }

const CARRIER_PATTERNS: CarrierPattern[] = [
  // USPS IMpb: 22 digits starting with 9 (e.g. 9205590327908752271203)
  { carrier: "USPS", pattern: /^9\d{21}$/, verified: true },
  // GoFo / CIRRO E-Commerce: "CR" + 12 digits (e.g. CR010177799525).
  // Identifier "CirroECommerce" was researched from EasyPost's own URLs but is
  // NOT yet confirmed live. BLOCKED until then: flip `verified: true` ONLY after
  // a live Carrier Metadata check confirms the exact carrier string — no other
  // change needed to start auto-registering GoFo.
  { carrier: "CirroECommerce", pattern: /^CR\d{12}$/, verified: false },
]

/**
 * Resolve the EasyPost carrier identifier for a tracking number by format.
 * Returns the explicit carrier string, or null when no pattern matches OR the
 * matched carrier is not yet verified. Never falls back to a default carrier and
 * never enables auto-detection.
 */
export function resolveCarrier(trackingNumber: string): CarrierId | null {
  const code = (trackingNumber ?? "").replace(/\s+/g, "").toUpperCase()
  if (!code) return null
  for (const { carrier, pattern, verified } of CARRIER_PATTERNS) {
    if (pattern.test(code)) return verified ? carrier : null
  }
  return null
}
