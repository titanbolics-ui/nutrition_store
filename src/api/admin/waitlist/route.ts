import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WAITLIST_MODULE } from "../../../modules/waitlist"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const waitlistSvc = req.scope.resolve(WAITLIST_MODULE) as any
  const { variant_id } = req.query as { variant_id?: string }

  if (variant_id) {
    const rows = await waitlistSvc.listWaitlists({ variant_id })
    return res.json({ rows })
  }

  const counts = await waitlistSvc.countsByVariant()
  return res.json({ counts })
}
