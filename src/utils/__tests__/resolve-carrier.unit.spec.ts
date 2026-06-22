import { resolveCarrier } from "../resolve-carrier"

describe("resolveCarrier", () => {
  // Real USPS IMpb samples (22 digits, start with 9)
  it("resolves USPS tracking numbers to USPS", () => {
    expect(resolveCarrier("9205590327908752271203")).toBe("USPS")
    expect(resolveCarrier("9205590327908752271197")).toBe("USPS")
    expect(resolveCarrier("9205590327908752271173")).toBe("USPS")
  })

  // GoFo ("CR" + 12 digits) is recognized but BLOCKED until the CirroECommerce
  // identifier is verified live — recognized format must resolve to null so the
  // fulfillment is flagged for manual review, NOT auto-registered.
  it("returns null for GoFo numbers while CirroECommerce is unverified", () => {
    expect(resolveCarrier("CR010177799525")).toBeNull()
    expect(resolveCarrier("CR010177795364")).toBeNull()
    expect(resolveCarrier("CR010159534183")).toBeNull()
  })

  it("normalizes whitespace and case before matching (USPS, verified)", () => {
    expect(resolveCarrier("  9205590327908752271203 ")).toBe("USPS")
    expect(resolveCarrier("9205 5903 2790 8752 2712 03")).toBe("USPS")
  })

  it("returns null for unknown formats — never defaults to a carrier", () => {
    expect(resolveCarrier("1Z999AA10123456784")).toBeNull() // UPS
    expect(resolveCarrier("420123459405511899223197428490")).toBeNull()
    expect(resolveCarrier("9205590327908752271")).toBeNull() // too short
    expect(resolveCarrier("CR01017779952")).toBeNull() // 11 digits
    expect(resolveCarrier("XX010177799525")).toBeNull()
  })

  it("returns null for empty / nullish input", () => {
    expect(resolveCarrier("")).toBeNull()
    expect(resolveCarrier(undefined as any)).toBeNull()
    expect(resolveCarrier(null as any)).toBeNull()
  })
})
