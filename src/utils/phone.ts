import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js"

const E164_RE = /^\+[1-9]\d{1,14}$/

// True when value is already a well-formed E.164 number. Read-time consumers
// of customer.phone (channel resolution, bot payloads) must gate on this —
// invalid phones are stored as entered and must route to channel=email.
export function isE164(value: string): boolean {
  return E164_RE.test(value)
}

// Normalize a phone to E.164 or return null when not confidently parseable.
// Rules: strip junk; leading "+" or "00" → international parse; otherwise
// parse with defaultCountry (ISO 3166-1 alpha-2, any case). Callers that
// persist phones keep the raw input when this returns null (never lose data).
export function normalizePhone(raw: string, defaultCountry?: string): string | null {
  const stripped = raw.replace(/[^\d+]/g, "")
  if (!stripped) return null

  const candidate = stripped.startsWith("00") ? "+" + stripped.slice(2) : stripped

  const parsed = candidate.startsWith("+")
    ? parsePhoneNumberFromString(candidate)
    : defaultCountry
      ? parsePhoneNumberFromString(candidate, defaultCountry.toUpperCase() as CountryCode)
      : undefined

  if (!parsed || !parsed.isPossible()) return null
  return parsed.format("E.164")
}

// Normalize body.phone in place for customer write endpoints.
// Must leave "" untouched (user clearing their number) and never add a
// missing phone key; unparseable values are kept as entered.
export function normalizeBodyPhone(body: unknown): void {
  if (!body || typeof body !== "object") return
  const record = body as Record<string, unknown>
  if (typeof record.phone !== "string" || record.phone === "") return
  record.phone = normalizePhone(record.phone) ?? record.phone
}
