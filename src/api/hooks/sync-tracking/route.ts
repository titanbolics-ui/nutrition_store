import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncTrackingFromSheets from "../../../jobs/sync-tracking-from-sheets"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const secret = process.env.SYNC_HOOK_SECRET
  if (secret && req.headers["x-sync-secret"] !== secret) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  try {
    await syncTrackingFromSheets(req.scope as any)
    res.json({ ok: true, message: "Sync completed — check server logs" })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
