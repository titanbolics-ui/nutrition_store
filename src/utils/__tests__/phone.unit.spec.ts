import { isE164, normalizeBodyPhone, normalizePhone } from "../phone"

describe("normalizePhone", () => {
  // Acceptance cases from the spec (Stage 0)
  it("parses international format with junk characters", () => {
    expect(normalizePhone("+49 (151) 234-56-78")).toBe("+491512345678")
  })

  it("parses national format with defaultCountry", () => {
    expect(normalizePhone("0151 2345678", "DE")).toBe("+491512345678")
    expect(normalizePhone("(555) 123-4567", "US")).toBe("+15551234567")
  })

  it("returns null for garbage", () => {
    expect(normalizePhone("garbage")).toBeNull()
  })

  it("treats leading 00 as international prefix", () => {
    expect(normalizePhone("00491512345678")).toBe("+491512345678")
  })

  // Edge cases
  it("returns null for national format without defaultCountry", () => {
    expect(normalizePhone("0151 2345678")).toBeNull()
  })

  it("accepts lowercase country codes (Medusa stores them lowercase)", () => {
    expect(normalizePhone("0151 2345678", "de")).toBe("+491512345678")
  })

  it("is a fixed point on already-normalized numbers (idempotency)", () => {
    expect(normalizePhone("+491512345678")).toBe("+491512345678")
    expect(normalizePhone("+491512345678", "US")).toBe("+491512345678")
  })

  it("returns null for empty/whitespace input", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone("   ")).toBeNull()
  })
})

describe("isE164", () => {
  it("accepts well-formed E.164", () => {
    expect(isE164("+491512345678")).toBe(true)
    expect(isE164("+15551234567")).toBe(true)
  })

  it("rejects non-E.164 values", () => {
    expect(isE164("0151 2345678")).toBe(false)
    expect(isE164("garbage")).toBe(false)
    expect(isE164("491512345678")).toBe(false)
    expect(isE164("+0151")).toBe(false)
    expect(isE164("")).toBe(false)
  })
})

describe("normalizeBodyPhone (POST /store/customers/me middleware)", () => {
  it("normalizes a parseable phone in place", () => {
    const body = { phone: "+49 (151) 234-56-78", first_name: "A" }
    normalizeBodyPhone(body)
    expect(body.phone).toBe("+491512345678")
    expect(body.first_name).toBe("A")
  })

  it("keeps unparseable phone as entered", () => {
    const body = { phone: "garbage" }
    normalizeBodyPhone(body)
    expect(body.phone).toBe("garbage")
  })

  it("leaves empty string untouched (user clearing their number)", () => {
    const body = { phone: "" }
    normalizeBodyPhone(body)
    expect(body.phone).toBe("")
  })

  it("does not add a missing phone key", () => {
    const body: Record<string, unknown> = { first_name: "A" }
    normalizeBodyPhone(body)
    expect("phone" in body).toBe(false)
  })

  it("ignores non-object and non-string bodies", () => {
    expect(() => normalizeBodyPhone(undefined)).not.toThrow()
    expect(() => normalizeBodyPhone(null)).not.toThrow()
    const body = { phone: 123 as unknown }
    normalizeBodyPhone(body)
    expect(body.phone).toBe(123)
  })
})
