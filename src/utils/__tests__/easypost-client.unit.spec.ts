import { createHmac } from "crypto"
import {
  verifyWebhookSignature,
  isDelivered,
  createTracker,
} from "../easypost-client"

const SECRET = "whsec_test_secret"

function sign(body: string, secret = SECRET): string {
  const digest = createHmac("sha256", Buffer.from(secret.normalize("NFKD"), "utf8"))
    .update(Buffer.from(body, "utf8"))
    .digest("hex")
  return `hmac-sha256-hex=${digest}`
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ result: { status: "delivered" } })

  it("accepts a valid signature (x-hmac-signature-v2)", () => {
    const headers = { "x-hmac-signature-v2": sign(body) }
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(true)
  })

  it("accepts a valid signature on the legacy x-hmac-signature header", () => {
    const headers = { "x-hmac-signature": sign(body) }
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(true)
  })

  it("rejects a tampered body", () => {
    const headers = { "x-hmac-signature-v2": sign(body) }
    const tampered = JSON.stringify({ result: { status: "in_transit" } })
    expect(verifyWebhookSignature(tampered, headers, SECRET)).toBe(false)
  })

  it("rejects a wrong secret", () => {
    const headers = { "x-hmac-signature-v2": sign(body, "other") }
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(false)
  })

  it("rejects when the signature header is missing", () => {
    expect(verifyWebhookSignature(body, {}, SECRET)).toBe(false)
  })

  it("rejects when no secret is configured", () => {
    const headers = { "x-hmac-signature-v2": sign(body) }
    expect(verifyWebhookSignature(body, headers, "")).toBe(false)
  })

  it("verifies over a raw Buffer body too", () => {
    const headers = { "x-hmac-signature-v2": sign(body) }
    expect(verifyWebhookSignature(Buffer.from(body, "utf8"), headers, SECRET)).toBe(true)
  })
})

describe("verifyWebhookSignature — weight correction (EasyPost parity)", () => {
  // EasyPost signs the body with integer `weight` values rewritten to `<n>.0`.
  // A real tracker payload carries a weight, so the verifier MUST sign the
  // corrected body — otherwise every real webhook would 401 (fail-closed).
  const rawBody =
    '{"result":{"tracking_code":"9205590327908752271203","status":"delivered","weight":16}}'
  const correctedBody =
    '{"result":{"tracking_code":"9205590327908752271203","status":"delivered","weight":16.0}}'

  it("accepts a signature computed over the corrected (weight .0) body", () => {
    const headers = { "x-hmac-signature": sign(correctedBody) }
    expect(verifyWebhookSignature(rawBody, headers, SECRET)).toBe(true)
  })

  it("rejects a signature computed over the raw (uncorrected) body", () => {
    const headers = { "x-hmac-signature": sign(rawBody) }
    expect(verifyWebhookSignature(rawBody, headers, SECRET)).toBe(false)
  })

  it("leaves a float weight untouched (already .0)", () => {
    const floatBody =
      '{"result":{"status":"delivered","weight":16.5}}'
    const headers = { "x-hmac-signature": sign(floatBody) }
    expect(verifyWebhookSignature(floatBody, headers, SECRET)).toBe(true)
  })
})

describe("isDelivered", () => {
  it("is true only for top-level result.status === 'delivered'", () => {
    expect(isDelivered({ result: { status: "delivered" } })).toBe(true)
    expect(isDelivered({ result: { status: "in_transit" } })).toBe(false)
    expect(isDelivered({ result: {} })).toBe(false)
    expect(isDelivered({})).toBe(false)
  })
})

describe("createTracker", () => {
  const realFetch = global.fetch
  const realKey = process.env.EASYPOST_API_KEY

  beforeEach(() => {
    process.env.EASYPOST_API_KEY = "EZTESTKEY"
  })
  afterEach(() => {
    global.fetch = realFetch
    process.env.EASYPOST_API_KEY = realKey
  })

  it("POSTs with Basic auth (key + empty password) and explicit carrier", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: "trk_123", status: "pre_transit" }),
    })
    global.fetch = fetchMock as any

    const tracker = await createTracker("9205590327908752271203", "USPS")

    expect(tracker.id).toBe("trk_123")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.easypost.com/v2/trackers")
    expect(init.method).toBe("POST")
    const expectedAuth = `Basic ${Buffer.from("EZTESTKEY:").toString("base64")}`
    expect(init.headers.Authorization).toBe(expectedAuth)
    expect(JSON.parse(init.body)).toEqual({
      tracker: { tracking_code: "9205590327908752271203", carrier: "USPS" },
    })
  })

  it("throws on a non-2xx response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"error":"bad"}',
    }) as any

    await expect(createTracker("CR010177799525", "CirroECommerce")).rejects.toThrow(
      /HTTP 422/
    )
  })
})
