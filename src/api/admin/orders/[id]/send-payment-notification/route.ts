import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../../../../../modules/magic-token"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { amount_due, provider_id, currency_code } = req.body as {
    amount_due: number
    provider_id?: string
    currency_code?: string
  }

  const query = req.scope.resolve("query")
  const notificationService = req.scope.resolve("notification")
  const magicTokenSvc = req.scope.resolve(MAGIC_TOKEN_MODULE) as any

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "currency_code"],
    filters: { id },
  })

  const order = orders[0]
  if (!order?.email) {
    return res.status(404).json({ message: "Order not found" })
  }

  const orderViewToken = await magicTokenSvc.generateToken({
    email: order.email,
    type: "order_view",
    orderId: id,
  })

  // registered account → template hides the "Activate account" block
  const customerSvc = req.scope.resolve(Modules.CUSTOMER) as any
  const hasRegisteredAccount =
    (await customerSvc.listCustomers({ email: order.email, has_account: true }))
      .length > 0

  await notificationService.createNotifications({
    to: order.email,
    channel: "email",
    template: "payment-notification",
    data: {
      order: {
        id: order.id,
        display_id: order.display_id,
        email: order.email,
        currency_code: currency_code || order.currency_code,
      },
      amountDue: amount_due,
      providerId: provider_id || "",
      orderViewToken,
      hasRegisteredAccount,
    },
  })

  res.status(200).json({ success: true })
}
