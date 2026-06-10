import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { OrderWorkflowEvents, OrderEditWorkflowEvents } from "@medusajs/framework/utils"
import { MAGIC_TOKEN_MODULE } from "../modules/magic-token"

async function getOrderEmail(orderId: string, container: any): Promise<string | null> {
  const query = container.resolve("query")
  const { data } = await query.graph({
    entity: "order",
    fields: ["email"],
    filters: { id: orderId },
  })
  return data[0]?.email ?? null
}

export default async function generateOrderViewToken({
  event: { name: eventName, data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve("logger")
  const magicTokenSvc = container.resolve(MAGIC_TOKEN_MODULE) as any

  let orderId: string | null = null

  if (eventName === OrderWorkflowEvents.PLACED) {
    orderId = (data as any).id
  } else if (
    eventName === OrderEditWorkflowEvents.CONFIRMED ||
    eventName === OrderWorkflowEvents.FULFILLMENT_CREATED
  ) {
    orderId = (data as any).order_id
  }

  if (!orderId) return

  try {
    const email = await getOrderEmail(orderId, container)
    if (!email) {
      logger.warn(`[generate-order-view-token] No email for order ${orderId}`)
      return
    }

    await magicTokenSvc.generateToken({
      email,
      type: "order_view",
      orderId,
    })

    logger.info(`[generate-order-view-token] Token generated for order ${orderId} (${eventName})`)
  } catch (e: any) {
    logger.error(`[generate-order-view-token] Failed for order ${orderId}: ${e.message}`)
  }
}

export const config: SubscriberConfig = {
  event: [
    OrderWorkflowEvents.PLACED,
    OrderEditWorkflowEvents.CONFIRMED,
    OrderWorkflowEvents.FULFILLMENT_CREATED,
  ],
}
