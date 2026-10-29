import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { evaluateOrderMinimum } from "../../../../../utils/repeat-customer"

// GET /store/carts/:id/order-minimum
// Whether the repeat-customer order minimum applies to this cart and how much
// is still missing. Exposes only a boolean + amounts — never past-order data.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
  const result = await evaluateOrderMinimum(req.scope, cartId)
  res.status(200).json(result)
}
