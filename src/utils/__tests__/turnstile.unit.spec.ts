import { verifyTurnstile } from "../turnstile"

describe("verifyTurnstile", () => {
  const OLD_ENV = process.env
  const fetchMock = jest.fn()

  beforeEach(() => {
    process.env = { ...OLD_ENV }
    ;(global as any).fetch = fetchMock
    fetchMock.mockReset()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it("fails closed when TURNSTILE_SECRET_KEY is unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const ok = await verifyTurnstile("some-token")
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns false for an empty token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    const ok = await verifyTurnstile("")
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns true when Cloudflare reports success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    fetchMock.mockResolvedValue({ json: async () => ({ success: true }) })
    const ok = await verifyTurnstile("valid-token", "1.2.3.4")
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("returns false when Cloudflare reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    fetchMock.mockResolvedValue({ json: async () => ({ success: false }) })
    const ok = await verifyTurnstile("bad-token")
    expect(ok).toBe(false)
  })

  it("returns false when the request throws", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    fetchMock.mockRejectedValue(new Error("network down"))
    const ok = await verifyTurnstile("some-token")
    expect(ok).toBe(false)
  })
})
