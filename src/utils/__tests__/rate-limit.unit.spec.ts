import { checkRateLimit } from "../rate-limit"

describe("checkRateLimit", () => {
  it("allows requests up to max within the window, then rejects", () => {
    const key = `test-key-${Date.now()}-${Math.random()}`
    const opts = { max: 3, windowMs: 60_000 }

    expect(checkRateLimit(key, opts)).toBe(true)
    expect(checkRateLimit(key, opts)).toBe(true)
    expect(checkRateLimit(key, opts)).toBe(true)
    expect(checkRateLimit(key, opts)).toBe(false)
  })

  it("tracks separate keys independently", () => {
    const opts = { max: 1, windowMs: 60_000 }
    const keyA = `a-${Date.now()}-${Math.random()}`
    const keyB = `b-${Date.now()}-${Math.random()}`

    expect(checkRateLimit(keyA, opts)).toBe(true)
    expect(checkRateLimit(keyB, opts)).toBe(true)
    expect(checkRateLimit(keyA, opts)).toBe(false)
    expect(checkRateLimit(keyB, opts)).toBe(false)
  })

  it("resets after the window elapses", () => {
    const key = `reset-${Date.now()}-${Math.random()}`
    const opts = { max: 1, windowMs: 10 }

    expect(checkRateLimit(key, opts)).toBe(true)
    expect(checkRateLimit(key, opts)).toBe(false)

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, opts)).toBe(true)
        resolve(null)
      }, 20)
    })
  })
})
