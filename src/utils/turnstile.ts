const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Fail closed: an unset secret rejects every request rather than skipping the
// check silently — a bot gate that quietly no-ops is worse than none.
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is unset — failing closed")
    return false
  }
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set("remoteip", remoteIp)

  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body })
    const data = await res.json()
    if (data.success !== true) {
      console.error("[turnstile] siteverify rejected:", data["error-codes"])
    }
    return data.success === true
  } catch (err) {
    console.error("[turnstile] siteverify request failed:", err)
    return false
  }
}
