import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"

function maskAddress(addr: any): any {
  if (!addr) return null
  const numMatch = String(addr.address_1 ?? "").match(/\d+\S*$/)
  return {
    address_1: numMatch ? `*** ${numMatch[0]}` : "***",
    address_2: addr.address_2 ? "***" : null,
    city: addr.city,
    postal_code: addr.postal_code,
    country_code: addr.country_code,
    province: addr.province,
    phone: addr.phone ? `****${String(addr.phone).slice(-4)}` : null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { token: rawToken } = req.params

  const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerSvc = req.scope.resolve(Modules.CUSTOMER) as any

  let tokenData: { email: string; orderId: string | null }
  try {
    tokenData = await magicTokenSvc.verifyToken(rawToken, "order_view")
  } catch (e: any) {
    return res.status(401).json({ message: e.message })
  }

  if (!tokenData.orderId) {
    return res.status(400).json({ message: "Token is not linked to an order." })
  }

  // Fetch order — masking happens below, not on frontend
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "status", "payment_status", "currency_code",
      "email", "total", "subtotal", "discount_total", "tax_total", "shipping_total",
      "items.id", "items.title", "items.product_title", "items.variant_title",
      "items.thumbnail", "items.quantity", "items.unit_price", "items.total",
      "shipping_address.address_1", "shipping_address.address_2",
      "shipping_address.city", "shipping_address.postal_code",
      "shipping_address.country_code", "shipping_address.province",
      "shipping_address.phone",
      "fulfillments.id", "fulfillments.tracking_links.tracking_number",
      "fulfillments.tracking_links.url", "fulfillments.shipped_at",
      "fulfillments.delivered_at",
    ],
    filters: { id: tokenData.orderId },
  })

  const order = orders[0]
  if (!order) return res.status(404).json({ message: "Order not found." })

  // Check if a registered account exists for this email — determines which block to show
  const registeredCustomers = await customerSvc.listCustomers({
    email: order.email,
    has_account: true,
  })
  const hasRegisteredAccount = registeredCustomers.length > 0

  res.json({
    order: {
      ...order,
      email: order.email,
      shipping_address: maskAddress(order.shipping_address),
    },
    has_registered_account: hasRegisteredAccount,
  })
}
