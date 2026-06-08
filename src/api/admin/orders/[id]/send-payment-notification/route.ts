import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { amount_due, provider_id, currency_code } = req.body as {
    amount_due: number
    provider_id?: string
    currency_code?: string
  }

  const query = req.scope.resolve("query")
  const notificationService = req.scope.resolve("notification")

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "currency_code"],
    filters: { id },
  })

  const order = orders[0]
  if (!order?.email) {
    return res.status(404).json({ message: "Order not found" })
  }

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
    },
  })

  res.status(200).json({ success: true })
}
