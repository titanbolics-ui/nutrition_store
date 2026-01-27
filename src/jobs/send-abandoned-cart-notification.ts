import { MedusaContainer } from "@medusajs/types"
import { 
  sendAbandonedCartsWorkflow, 
  SendAbandonedCartsWorkflowInput,
} from "../workflows/send-abandoned-carts"

export default async function abandonedCartJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const query = container.resolve("query")

  const oneDayAgo = new Date()
  //oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  oneDayAgo.setSeconds(oneDayAgo.getSeconds() - 10) // 10 seconds ago for instant testing 
  const limit = 100
  let offset = 0
  let totalCount = 0
  let abandonedCartsCount = 0

  do {
    const { 
      data: abandonedCarts, 
      metadata,
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "items.*",
        "metadata",
        "customer.*",
        "shipping_address.*",
      ],
      filters: {
        updated_at: {
          $lt: oneDayAgo,
        },
        email: {
          $ne: null,
        },
        completed_at: null,
      },
      pagination: {
        skip: offset,
        take: limit,
      },
    })

    totalCount = metadata?.count ?? 0
    
    logger.info(`🔍 Found ${abandonedCarts.length} carts total`)
    
    abandonedCarts.forEach((cart) => {
      const hasItems = cart.items?.length > 0
      const hasNotification = !!cart.metadata?.abandoned_notification
      const isTitanbolics = cart.email === "titanbolics@gmail.com"
      const passed = hasItems && !hasNotification && isTitanbolics
      
      logger.info(`  Cart ${cart.id}:`)
      logger.info(`    - email: ${cart.email}`)
      logger.info(`    - items: ${cart.items?.length || 0}`)
      logger.info(`    - has_notification: ${hasNotification}`)
      logger.info(`    - is_titanbolics: ${isTitanbolics}`)
      logger.info(`    - PASSED: ${passed ? '✅' : '❌'}`)
    })
    
    const cartsWithItems = abandonedCarts.filter((cart) => 
      cart.items?.length > 0 && 
      !cart.metadata?.abandoned_notification &&
      cart.email === "titanbolics@gmail.com" // FOR TESTING ONLY
    )
    
    logger.info(`✅ Filtered to ${cartsWithItems.length} carts for titanbolics@gmail.com`)

    if (cartsWithItems.length > 0) {
      try {
        await sendAbandonedCartsWorkflow(container).run({
          input: {
            carts: cartsWithItems,
          } as unknown as SendAbandonedCartsWorkflowInput,
        })
        abandonedCartsCount += cartsWithItems.length
      } catch (error) {
        logger.error(
          `Failed to send abandoned cart notification: ${error.message}`
        )
      }
    }

    offset += limit
  } while (offset < totalCount)

  logger.info(`Sent ${abandonedCartsCount} abandoned cart notifications`)
}

export const config = {
  name: "abandoned-cart-notification",
  schedule: "* * * * *", // Run every minute (FOR TESTING)
}

