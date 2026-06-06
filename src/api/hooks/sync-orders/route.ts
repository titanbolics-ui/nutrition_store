import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncOrdersToSheets from "../../../jobs/sync-orders-to-sheets"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const secret = process.env.SYNC_HOOK_SECRET
  if (secret && req.headers["x-sync-secret"] !== secret) {
    return res.status(401).json({ message: "Unauthorized" })
  }
  try {
    await syncOrdersToSheets(req.scope as any)
    res.json({ ok: true, message: "Order sync completed — check server logs" })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
