import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  quoteSurcharge,
  syncPaymentSurcharge,
} from "../../../../../utils/payment-surcharge"

// GET /store/carts/:id/payment-surcharge
// Quote for the PayPal option badge: { provider_id, percent, amount }.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
  res.status(200).json(await quoteSurcharge(req.scope, cartId))
}

// POST /store/carts/:id/payment-surcharge  { provider_id: string | null }
// Sync the surcharge to the chosen provider. Call before creating the payment
// session so the session amount already includes the surcharge.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
  const providerId = (req.body as any)?.provider_id
  await syncPaymentSurcharge(
    req.scope,
    cartId,
    typeof providerId === "string" && providerId ? providerId : null
  )
  res.status(200).json(await quoteSurcharge(req.scope, cartId))
}
