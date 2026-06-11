import { parsePhoneNumber } from "libphonenumber-js"

// Normalize phone to E.164 if parseable; otherwise strip noise (non-digits / non-+)
// and convert leading 00 to +. Falls back gracefully — a non-parseable value stays usable.
// E.164 is required for WhatsApp bot matching.
export function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "")
  const candidate = stripped.startsWith("00") ? "+" + stripped.slice(2) : stripped
  try {
    return parsePhoneNumber(candidate).format("E.164")
  } catch (_) {
    return candidate
  }
}
